import {
  MESSAGES_PAGE_MAX_LIMIT,
  type ChatMessage,
  type MessagePage,
} from "@workspace/contracts"
import { useCallback, useEffect, useReducer, useRef, useState } from "react"

import { fetchMessages } from "@/features/chat/api/messages"
import { useTypingIndicator } from "@/features/chat/hooks/use-typing-indicator"
import { useTypingUsers } from "@/features/chat/hooks/use-typing-users"
import { useChatSession } from "@/features/chat/session/chat-session-context"
import { emitWithAck } from "@/lib/socket"

/* --------------------------------- estado --------------------------------- */

interface State {
  messages: ChatMessage[]
  hasOlder: boolean
  status: "loading" | "ready" | "error"
  error: string | null
}

type Action =
  | { type: "reset" }
  /** Mescla sem duplicar; `hasOlder` só é atualizado quando informado. */
  | { type: "merge"; items: ChatMessage[]; hasOlder?: boolean }
  /** Troca tudo (ex.: ficou offline tempo demais para sincronizar). */
  | { type: "replace"; page: MessagePage }
  | { type: "fail"; error: string }

const initialState: State = {
  messages: [],
  hasOlder: false,
  status: "loading",
  error: null,
}

/** Ordem canônica do servidor: (createdAt, id). */
function compareMessages(a: ChatMessage, b: ChatMessage) {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Histórico (REST), eventos ao vivo (socket) e sincronização podem trazer a
 * mesma mensagem mais de uma vez e fora de ordem. Mesclar por id torna todas
 * essas fontes idempotentes.
 */
function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((m) => [m.id, m]))
  for (const message of incoming) byId.set(message.id, message)
  return [...byId.values()].sort(compareMessages)
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "reset":
      return initialState
    case "merge":
      return {
        ...state,
        messages: mergeMessages(state.messages, action.items),
        hasOlder: action.hasOlder ?? state.hasOlder,
        status: action.hasOlder !== undefined ? "ready" : state.status,
        error: null,
      }
    case "replace":
      return {
        messages: action.page.items,
        hasOlder: action.page.hasOlder,
        status: "ready",
        error: null,
      }
    case "fail":
      return { ...state, status: "error", error: action.error }
  }
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Erro inesperado"

/* ---------------------------------- hook ---------------------------------- */

/**
 * Tudo o que uma tela de conversa precisa: histórico paginado, mensagens ao
 * vivo, envio e "digitando". Cuida de entrar na sala e de entrar de novo
 * (com sincronização) a cada reconexão.
 */
export function useConversation(conversationId: string) {
  const { socket, status: connection, user } = useChatSession()
  const { token } = user
  const [state, dispatch] = useReducer(reducer, initialState)
  const [isJoined, setIsJoined] = useState(false)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)

  const messagesRef = useRef(state.messages)
  const loadingOlderRef = useRef(false)
  useEffect(() => {
    messagesRef.current = state.messages
  })

  const lastMessage = useCallback(
    () =>
      messagesRef.current
        .filter((m) => m.conversationId === conversationId)
        .at(-1),
    [conversationId]
  )

  /* 1) Histórico inicial via REST (não depende do socket estar conectado). */
  useEffect(() => {
    dispatch({ type: "reset" })
    const controller = new AbortController()

    fetchMessages(token, conversationId, {}, controller.signal)
      .then((page) =>
        dispatch({ type: "merge", items: page.items, hasOlder: page.hasOlder })
      )
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          dispatch({ type: "fail", error: errorMessage(error) })
        }
      })

    return () => controller.abort()
  }, [token, conversationId])

  /*
   * 2) Entrar na sala. O evento "connect" dispara na primeira conexão E em
   * cada reconexão; as salas do servidor se perdem quando a conexão cai, então
   * precisamos entrar de novo e buscar o que chegou enquanto estávamos fora.
   */
  useEffect(() => {
    let cancelled = false

    const catchUp = async () => {
      const last = lastMessage()
      try {
        if (!last) {
          // O histórico inicial pode ter sido lido antes do join: relê.
          const page = await fetchMessages(token, conversationId)
          if (!cancelled) {
            dispatch({ type: "merge", items: page.items, hasOlder: page.hasOlder })
          }
          return
        }

        const page = await fetchMessages(token, conversationId, {
          after: last.id,
          limit: MESSAGES_PAGE_MAX_LIMIT,
        })
        if (cancelled) return
        if (!page.hasNewer) {
          dispatch({ type: "merge", items: page.items })
          return
        }
        // Perdemos mais que uma página: recomeça do presente.
        const latest = await fetchMessages(token, conversationId)
        if (!cancelled) dispatch({ type: "replace", page: latest })
      } catch {
        // Cursor pode não existir mais (ex.: servidor reiniciou sem banco).
        const latest = await fetchMessages(token, conversationId)
        if (!cancelled) dispatch({ type: "replace", page: latest })
      }
    }

    const join = async () => {
      try {
        await emitWithAck(socket, "conversation:join", { conversationId })
        if (cancelled) return
        setIsJoined(true)
        await catchUp()
      } catch (error) {
        if (!cancelled) dispatch({ type: "fail", error: errorMessage(error) })
      }
    }

    const onDisconnect = () => setIsJoined(false)

    socket.on("connect", join)
    socket.on("disconnect", onDisconnect)
    if (socket.connected) void join()

    return () => {
      cancelled = true
      socket.off("connect", join)
      socket.off("disconnect", onDisconnect)
      setIsJoined(false)
      if (socket.connected) {
        emitWithAck(socket, "conversation:leave", { conversationId }).catch(
          () => {}
        )
      }
    }
  }, [socket, token, conversationId, lastMessage])

  /* 3) Mensagens ao vivo. */
  useEffect(() => {
    const onNewMessage = (message: ChatMessage) => {
      if (message.conversationId !== conversationId) return
      dispatch({ type: "merge", items: [message] })
    }

    socket.on("message:new", onNewMessage)
    return () => {
      socket.off("message:new", onNewMessage)
    }
  }, [socket, conversationId])

  /* 4) "Digitando". */
  const { notifyTyping, stopTyping } = useTypingIndicator(
    socket,
    conversationId
  )
  const typingUserIds = useTypingUsers(socket, conversationId)

  /* ---------------------------------- ações --------------------------------- */

  const sendMessage = useCallback(
    async (content: string) => {
      stopTyping()
      const message = await emitWithAck(socket, "message:send", {
        conversationId,
        content,
      })
      // O broadcast também traz a mensagem; o merge evita duplicar.
      dispatch({ type: "merge", items: [message] })
      return message
    },
    [socket, conversationId, stopTyping]
  )

  const loadOlder = useCallback(async () => {
    const first = messagesRef.current[0]
    if (!first || loadingOlderRef.current) return

    loadingOlderRef.current = true
    setIsLoadingOlder(true)
    try {
      const page = await fetchMessages(token, conversationId, { before: first.id })
      dispatch({ type: "merge", items: page.items, hasOlder: page.hasOlder })
    } catch (error) {
      dispatch({ type: "fail", error: errorMessage(error) })
    } finally {
      loadingOlderRef.current = false
      setIsLoadingOlder(false)
    }
  }, [token, conversationId])

  return {
    ...state,
    currentUser: user,
    connection,
    isJoined,
    isLoadingOlder,
    typingUserIds,
    sendMessage,
    loadOlder,
    notifyTyping,
    stopTyping,
  }
}

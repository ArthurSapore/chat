import {
  MESSAGES_PAGE_MAX_LIMIT,
  REPLY_PREVIEW_MAX_LENGTH,
  type ChatMessage,
  type MemberReceipt,
  type MessagePage,
  type MessagesQueryParams,
  type ReactionType,
} from "@workspace/contracts"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react"

import { useTypingIndicator } from "@/features/chat/hooks/use-typing-indicator"
import { useTypingUsers } from "@/features/chat/hooks/use-typing-users"
import { useChatSessionContext } from "@/features/chat/context/chat-session-context"
import { listConversationMessagesRequest } from "@/features/chat/service/requests"
import type { ConversationMessage, LocalStatus } from "@/features/chat/types"
import { emitWithAck } from "@/lib/socket"

/* --------------------------------- estado --------------------------------- */

interface State {
  messages: ConversationMessage[]
  /** Marcadores de entrega/leitura de cada participante. */
  receipts: MemberReceipt[]
  hasOlder: boolean
  status: "loading" | "ready" | "error"
  error: string | null
}

type Action =
  | { type: "reset" }
  /** Mescla sem duplicar; `hasOlder` só é atualizado quando informado. */
  | { type: "merge"; items: ConversationMessage[]; hasOlder?: boolean }
  /** Substitui uma mensagem já carregada (edição/reação); ignora as demais. */
  | { type: "update"; message: ChatMessage }
  /** Troca tudo (ex.: ficou offline tempo demais para sincronizar). */
  | { type: "replace"; page: MessagePage }
  | { type: "set-local-status"; id: string; localStatus: LocalStatus }
  | { type: "remove"; id: string }
  | { type: "set-receipts"; receipts: MemberReceipt[] }
  | { type: "upsert-receipt"; receipt: MemberReceipt }
  | { type: "fail"; error: string }

const initialState: State = {
  messages: [],
  receipts: [],
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
 * Histórico (REST), eventos ao vivo (socket), sincronização e o próprio ack
 * podem trazer a mesma mensagem mais de uma vez e fora de ordem. Mesclar por
 * id torna todas essas fontes idempotentes. Uma mensagem confirmada também
 * substitui a otimista de mesmo clientId (que usa o clientId como id).
 */
function mergeMessages(
  current: ConversationMessage[],
  incoming: ConversationMessage[]
) {
  const byId = new Map(current.map((m) => [m.id, m]))
  for (const message of incoming) {
    if (message.clientId && message.clientId !== message.id) {
      byId.delete(message.clientId)
    }
    byId.set(message.id, message)
  }
  return [...byId.values()].sort(compareMessages)
}

const isConfirmed = (m: ConversationMessage) => !m.localStatus

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
    case "update":
      return state.messages.some((m) => m.id === action.message.id)
        ? {
            ...state,
            messages: state.messages.map((m) =>
              m.id === action.message.id ? action.message : m
            ),
          }
        : state
    case "replace":
      return {
        ...state,
        // Mensagens ainda não confirmadas continuam no fim.
        messages: mergeMessages(
          action.page.items,
          state.messages.filter((m) => !isConfirmed(m))
        ),
        hasOlder: action.page.hasOlder,
        status: "ready",
        error: null,
      }
    case "set-local-status":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id && m.localStatus
            ? { ...m, localStatus: action.localStatus }
            : m
        ),
      }
    case "remove":
      return {
        ...state,
        messages: state.messages.filter((m) => m.id !== action.id),
      }
    case "set-receipts":
      return { ...state, receipts: action.receipts }
    case "upsert-receipt":
      return {
        ...state,
        receipts: [
          ...state.receipts.filter((r) => r.userId !== action.receipt.userId),
          action.receipt,
        ],
      }
    case "fail":
      return { ...state, status: "error", error: action.error }
  }
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Erro inesperado"

/** Página de mensagens da conversa (atalho sobre o request). */
async function fetchPage(
  token: string,
  conversationId: string,
  query: MessagesQueryParams = {},
  signal?: AbortSignal
) {
  const { data } = await listConversationMessagesRequest(
    { conversationId, ...query },
    { token, signal }
  )
  return data
}

interface PendingSend {
  content: string
  replyToId?: string
}

/* ---------------------------------- hook ---------------------------------- */

/**
 * Tudo o que uma tela de conversa precisa: histórico paginado, mensagens ao
 * vivo, envio otimista, entregue/lida e "digitando". Cuida de entrar na sala
 * e de entrar de novo (com sincronização) a cada reconexão.
 */
export function useConversation(conversationId: string) {
  const { socket, status: connection, user } = useChatSessionContext()
  const { token } = user
  const [state, dispatch] = useReducer(reducer, initialState)
  const [isJoined, setIsJoined] = useState(false)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)

  const stateRef = useRef(state)
  const loadingOlderRef = useRef(false)
  /** Envios aguardando confirmação, por clientId (para reenviar). */
  const pendingSendsRef = useRef(new Map<string, PendingSend>())
  /** Último marcador já emitido, para não repetir antes do servidor responder. */
  const sentReceiptsRef = useRef({ delivered: "", read: "" })
  const visibleIdsRef = useRef<string[]>([])
  // Layout effect: atualiza antes dos efeitos dos filhos (ex.: a lista
  // avisando o que está visível), que leem esta ref no mesmo commit.
  useLayoutEffect(() => {
    stateRef.current = state
  })

  /** Última mensagem confirmada (cursor para sincronizar). */
  const lastConfirmed = useCallback(
    () =>
      stateRef.current.messages
        .filter((m) => m.conversationId === conversationId && isConfirmed(m))
        .at(-1),
    [conversationId]
  )

  /* 1) Histórico inicial via REST (não depende do socket estar conectado). */
  useEffect(() => {
    dispatch({ type: "reset" })
    sentReceiptsRef.current = { delivered: "", read: "" }
    const controller = new AbortController()

    fetchPage(token, conversationId, {}, controller.signal)
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
   * precisamos entrar de novo, atualizar os recibos e buscar o que chegou.
   */
  useEffect(() => {
    let cancelled = false

    const catchUp = async () => {
      const last = lastConfirmed()
      try {
        if (!last) {
          // O histórico inicial pode ter sido lido antes do join: relê.
          const page = await fetchPage(token, conversationId)
          if (!cancelled) {
            dispatch({
              type: "merge",
              items: page.items,
              hasOlder: page.hasOlder,
            })
          }
          return
        }

        const page = await fetchPage(token, conversationId, {
          after: last.id,
          limit: MESSAGES_PAGE_MAX_LIMIT,
        })
        if (cancelled) return
        if (!page.hasNewer) {
          dispatch({ type: "merge", items: page.items })
          return
        }
        // Perdemos mais que uma página: recomeça do presente.
        const latest = await fetchPage(token, conversationId)
        if (!cancelled) dispatch({ type: "replace", page: latest })
      } catch {
        // Cursor pode não existir mais (ex.: servidor reiniciou sem banco).
        const latest = await fetchPage(token, conversationId)
        if (!cancelled) dispatch({ type: "replace", page: latest })
      }
    }

    const join = async () => {
      try {
        const joined = await emitWithAck(socket, "conversation:join", {
          conversationId,
        })
        if (cancelled) return
        dispatch({ type: "set-receipts", receipts: joined.receipts })
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
  }, [socket, token, conversationId, lastConfirmed])

  /* 3) Eventos ao vivo: mensagens novas, alteradas e recibos. */
  useEffect(() => {
    const onNewMessage = (message: ChatMessage) => {
      if (message.conversationId !== conversationId) return
      if (message.clientId) pendingSendsRef.current.delete(message.clientId)
      dispatch({ type: "merge", items: [message] })
    }

    const onMessageUpdated = (message: ChatMessage) => {
      if (message.conversationId !== conversationId) return
      dispatch({ type: "update", message })
    }

    const onReceiptUpdated = (receipt: MemberReceipt) => {
      if (receipt.conversationId !== conversationId) return
      dispatch({ type: "upsert-receipt", receipt })
    }

    socket.on("message:new", onNewMessage)
    socket.on("message:updated", onMessageUpdated)
    socket.on("receipt:updated", onReceiptUpdated)
    return () => {
      socket.off("message:new", onNewMessage)
      socket.off("message:updated", onMessageUpdated)
      socket.off("receipt:updated", onReceiptUpdated)
    }
  }, [socket, conversationId])

  /* 4) Entregue: a mensagem mais recente de outra pessoa chegou aqui. */
  const myReceipt = state.receipts.find((r) => r.userId === user.id)
  const latestIncoming = state.messages.findLast(
    (m) => m.senderId !== user.id && isConfirmed(m)
  )

  useEffect(() => {
    if (!isJoined || !latestIncoming) return
    const { createdAt, id } = latestIncoming
    if (myReceipt?.deliveredAt && myReceipt.deliveredAt >= createdAt) return
    if (sentReceiptsRef.current.delivered >= createdAt) return

    sentReceiptsRef.current.delivered = createdAt
    socket.emit("conversation:delivered", { conversationId, messageId: id })
  }, [socket, conversationId, isJoined, latestIncoming, myReceipt?.deliveredAt])

  /* 5) Lida: a mensagem de outra pessoa apareceu na tela (com a aba visível). */
  const flushRead = useCallback(() => {
    if (document.visibilityState !== "visible") return

    const { messages, receipts } = stateRef.current
    const visible = new Set(visibleIdsRef.current)
    const newestSeen = messages.findLast(
      (m) => visible.has(m.id) && m.senderId !== user.id && isConfirmed(m)
    )
    if (!newestSeen) return

    const readAt = receipts.find((r) => r.userId === user.id)?.readAt
    if (readAt && readAt >= newestSeen.createdAt) return
    if (sentReceiptsRef.current.read >= newestSeen.createdAt) return

    sentReceiptsRef.current.read = newestSeen.createdAt
    socket.emit("conversation:read", {
      conversationId,
      messageId: newestSeen.id,
    })
  }, [socket, conversationId, user.id])

  /** Chamado pela lista sempre que o conjunto de mensagens visíveis muda. */
  const markVisible = useCallback(
    (messageIds: string[]) => {
      visibleIdsRef.current = messageIds
      flushRead()
    },
    [flushRead]
  )

  // Voltar para a aba conta como ver o que já estava na tela.
  useEffect(() => {
    document.addEventListener("visibilitychange", flushRead)
    return () => document.removeEventListener("visibilitychange", flushRead)
  }, [flushRead])

  /* 6) "Digitando". */
  const { notifyTyping, stopTyping } = useTypingIndicator(
    socket,
    conversationId
  )
  const typingUserIds = useTypingUsers(socket, conversationId)

  /* ---------------------------------- ações --------------------------------- */

  /** Envia (ou reenvia) uma mensagem otimista pelo clientId. */
  const deliver = useCallback(
    async (clientId: string) => {
      const pending = pendingSendsRef.current.get(clientId)
      if (!pending) return

      try {
        const message = await emitWithAck(socket, "message:send", {
          conversationId,
          content: pending.content,
          replyToId: pending.replyToId,
          clientId,
        })
        pendingSendsRef.current.delete(clientId)
        dispatch({ type: "merge", items: [message] })
      } catch {
        dispatch({
          type: "set-local-status",
          id: clientId,
          localStatus: "failed",
        })
      }
    },
    [socket, conversationId]
  )

  /**
   * Envio otimista: a mensagem aparece na hora como "enviando" e é trocada
   * pela confirmada quando o servidor responde. Não lança erro: uma falha
   * vira status "failed" na própria mensagem, com opção de reenviar.
   */
  const sendMessage = useCallback(
    async (content: string, options: { replyToId?: string } = {}) => {
      stopTyping()
      const clientId = crypto.randomUUID()
      const replyTarget = options.replyToId
        ? stateRef.current.messages.find((m) => m.id === options.replyToId)
        : undefined

      const optimistic: ConversationMessage = {
        id: clientId,
        clientId,
        conversationId,
        senderId: user.id,
        content: content.trim(),
        createdAt: new Date().toISOString(),
        editedAt: null,
        replyTo: replyTarget
          ? {
              id: replyTarget.id,
              senderId: replyTarget.senderId,
              content: replyTarget.content.slice(0, REPLY_PREVIEW_MAX_LENGTH),
            }
          : null,
        reactions: [],
        forwardedFrom: null,
        localStatus: "sending",
      }

      pendingSendsRef.current.set(clientId, {
        content,
        replyToId: options.replyToId,
      })
      dispatch({ type: "merge", items: [optimistic] })
      void deliver(clientId)
    },
    [conversationId, user.id, deliver, stopTyping]
  )

  const retryMessage = useCallback(
    (clientId: string) => {
      dispatch({
        type: "set-local-status",
        id: clientId,
        localStatus: "sending",
      })
      void deliver(clientId)
    },
    [deliver]
  )

  const discardMessage = useCallback((clientId: string) => {
    pendingSendsRef.current.delete(clientId)
    dispatch({ type: "remove", id: clientId })
  }, [])

  /** Só o autor, dentro do prazo; o servidor valida as duas regras. */
  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      stopTyping()
      const message = await emitWithAck(socket, "message:edit", {
        messageId,
        content,
      })
      dispatch({ type: "update", message })
      return message
    },
    [socket, stopTyping]
  )

  /** Mesma reação remove; outra substitui. */
  const toggleReaction = useCallback(
    async (messageId: string, type: ReactionType) => {
      try {
        const message = await emitWithAck(socket, "message:react", {
          messageId,
          type,
        })
        dispatch({ type: "update", message })
      } catch (error) {
        dispatch({ type: "fail", error: errorMessage(error) })
      }
    },
    [socket]
  )

  const loadOlder = useCallback(async () => {
    const first = stateRef.current.messages.find(isConfirmed)
    if (!first || loadingOlderRef.current) return

    loadingOlderRef.current = true
    setIsLoadingOlder(true)
    try {
      const page = await fetchPage(token, conversationId, {
        before: first.id,
      })
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
    retryMessage,
    discardMessage,
    editMessage,
    toggleReaction,
    markVisible,
    loadOlder,
    notifyTyping,
    stopTyping,
  }
}

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react"

import type { SessionUser } from "@/config/dev-users"
import { createChatSocket, type ChatSocket } from "@/lib/socket"

export type ConnectionStatus = "connecting" | "connected" | "disconnected"

// 1. Props do provider: quem usa este chat + children
interface ChatSessionContextProps extends PropsWithChildren {
  user: SessionUser
}

// 2. Valores expostos: as props (sem children) + a conexão
interface ChatSessionContextValues extends Omit<
  ChatSessionContextProps,
  "children"
> {
  socket: ChatSocket
  status: ConnectionStatus
}

// 3. Contexto tipado, iniciando em null (não exportado: o consumo é pelo hook)
const ChatSessionContext = createContext<ChatSessionContextValues | null>(null)

// 4. Provider: ChatSessionContextProvider
/**
 * Uma sessão = um usuário + a conexão dele. Cria o socket com o token do
 * usuário, conecta ao montar, desconecta ao desmontar e expõe o status.
 *
 * Várias sessões podem coexistir na mesma página (cada uma com seu socket).
 * Troque a `key` do provider ao trocar de usuário para recriar a conexão.
 */
export function ChatSessionContextProvider({
  children,
  user,
}: ChatSessionContextProps) {
  const [socket] = useState(function createSocket() {
    return createChatSocket(user.token)
  })
  const [status, setStatus] = useState<ConnectionStatus>("connecting")

  useEffect(
    function connectSocket() {
      function onConnect() {
        setStatus("connected")
      }
      function onDisconnect() {
        setStatus("disconnected")
      }
      function onReconnectAttempt() {
        setStatus("connecting")
      }
      function onConnectError(error: Error) {
        console.error(`[socket:${user.id}] erro de conexão:`, error.message)
        setStatus(socket.active ? "connecting" : "disconnected")
      }

      socket.on("connect", onConnect)
      socket.on("disconnect", onDisconnect)
      socket.on("connect_error", onConnectError)
      socket.io.on("reconnect_attempt", onReconnectAttempt)

      socket.connect()

      return function disconnectSocket() {
        socket.off("connect", onConnect)
        socket.off("disconnect", onDisconnect)
        socket.off("connect_error", onConnectError)
        socket.io.off("reconnect_attempt", onReconnectAttempt)
        socket.disconnect()
      }
    },
    [socket, user.id]
  )

  const value = useMemo(
    function buildValue() {
      return { user, socket, status }
    },
    [user, socket, status]
  )

  return (
    <ChatSessionContext.Provider value={value}>
      {children}
    </ChatSessionContext.Provider>
  )
}

// 5. Hook de consumo: falha se usado fora do provider
export function useChatSessionContext(): ChatSessionContextValues {
  const context = useContext(ChatSessionContext)

  if (!context) {
    throw new Error(
      "ChatSessionContext must be used inside of ChatSessionContextProvider"
    )
  }

  return context
}

import { useEffect, useMemo, useState, type ReactNode } from "react"

import type { SessionUser } from "@/config/dev-users"
import {
  ChatSessionContext,
  type ConnectionStatus,
} from "@/features/chat/session/chat-session-context"
import { createChatSocket } from "@/lib/socket"

/**
 * Uma sessão = um usuário + a conexão dele. Cria o socket com o token do
 * usuário, conecta ao montar, desconecta ao desmontar e expõe o status.
 *
 * Várias sessões podem coexistir na mesma página (cada uma com seu socket).
 * Troque a `key` do provider ao trocar de usuário para recriar a conexão.
 */
export function ChatSessionProvider({
  user,
  children,
}: {
  user: SessionUser
  children: ReactNode
}) {
  const [socket] = useState(() => createChatSocket(user.token))
  const [status, setStatus] = useState<ConnectionStatus>("connecting")

  useEffect(() => {
    const onConnect = () => setStatus("connected")
    const onDisconnect = () => setStatus("disconnected")
    const onReconnectAttempt = () => setStatus("connecting")
    const onConnectError = (error: Error) => {
      console.error(`[socket:${user.id}] erro de conexão:`, error.message)
      setStatus(socket.active ? "connecting" : "disconnected")
    }

    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on("connect_error", onConnectError)
    socket.io.on("reconnect_attempt", onReconnectAttempt)

    socket.connect()

    return () => {
      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off("connect_error", onConnectError)
      socket.io.off("reconnect_attempt", onReconnectAttempt)
      socket.disconnect()
    }
  }, [socket, user.id])

  const value = useMemo(
    () => ({ user, socket, status }),
    [user, socket, status]
  )

  return <ChatSessionContext value={value}>{children}</ChatSessionContext>
}

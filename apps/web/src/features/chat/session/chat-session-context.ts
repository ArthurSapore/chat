import { createContext, useContext } from "react"

import type { SessionUser } from "@/config/dev-users"
import type { ChatSocket } from "@/lib/socket"

export type ConnectionStatus = "connecting" | "connected" | "disconnected"

/** Quem está usando este chat e por qual conexão. */
export interface ChatSessionValue {
  user: SessionUser
  socket: ChatSocket
  status: ConnectionStatus
}

export const ChatSessionContext = createContext<ChatSessionValue | null>(null)

export function useChatSession() {
  const value = useContext(ChatSessionContext)
  if (!value) {
    throw new Error("useChatSession precisa estar dentro de <ChatSessionProvider>")
  }
  return value
}

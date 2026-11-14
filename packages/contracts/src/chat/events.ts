import type { Ack } from "../errors"
import type { ChatMessage, ConversationRef, SendMessageInput } from "./schemas"

export interface TypingPayload {
  userId: string
  conversationId: string
}

export interface ClientToServerEvents {
  "conversation:join": (
    data: ConversationRef,
    ack: (response: Ack<ConversationRef>) => void
  ) => void

  "conversation:leave": (
    data: ConversationRef,
    ack: (response: Ack<ConversationRef>) => void
  ) => void

  "message:send": (
    data: SendMessageInput,
    ack: (response: Ack<ChatMessage>) => void
  ) => void

  "typing:start": (data: ConversationRef) => void
  "typing:stop": (data: ConversationRef) => void
}

export interface ServerToClientEvents {
  "message:new": (message: ChatMessage) => void
  "user:typing": (data: TypingPayload) => void
  "user:stopped_typing": (data: TypingPayload) => void
}

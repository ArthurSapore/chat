import type { Ack } from "../errors"
import type {
  ChatMessage,
  ConversationJoined,
  ConversationRef,
  EditMessageInput,
  MemberReceipt,
  ReactToMessageInput,
  ReceiptUpdateInput,
  SendMessageInput,
} from "./schemas"

export interface TypingPayload {
  userId: string
  conversationId: string
}

export interface ClientToServerEvents {
  /** Entra na sala e recebe os marcadores de entrega/leitura atuais. */
  "conversation:join": (
    data: ConversationRef,
    ack: (response: Ack<ConversationJoined>) => void
  ) => void

  "conversation:leave": (
    data: ConversationRef,
    ack: (response: Ack<ConversationRef>) => void
  ) => void

  "message:send": (
    data: SendMessageInput,
    ack: (response: Ack<ChatMessage>) => void
  ) => void

  /** Só o autor, até MESSAGE_EDIT_WINDOW_MS depois do envio. */
  "message:edit": (
    data: EditMessageInput,
    ack: (response: Ack<ChatMessage>) => void
  ) => void

  "message:react": (
    data: ReactToMessageInput,
    ack: (response: Ack<ChatMessage>) => void
  ) => void

  /** A mensagem chegou ao dispositivo (ao vivo ou na sincronização). */
  "conversation:delivered": (data: ReceiptUpdateInput) => void
  /** A mensagem apareceu na tela do usuário. Implica entregue. */
  "conversation:read": (data: ReceiptUpdateInput) => void

  "typing:start": (data: ConversationRef) => void
  "typing:stop": (data: ConversationRef) => void
}

export interface ServerToClientEvents {
  "message:new": (message: ChatMessage) => void
  /** Mensagem alterada (edição ou reação): substitui a versão anterior. */
  "message:updated": (message: ChatMessage) => void
  /** O marcador de entrega/leitura de um participante avançou. */
  "receipt:updated": (receipt: MemberReceipt) => void
  "user:typing": (data: TypingPayload) => void
  "user:stopped_typing": (data: TypingPayload) => void
}

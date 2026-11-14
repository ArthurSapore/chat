import type {
  ChatMessage,
  MessagePage,
  MessagesQuery,
} from "@workspace/contracts"

export interface CreateMessageData {
  conversationId: string
  senderId: string
  content: string
}

/**
 * Porta de persistência das mensagens.
 *
 * A ordem canônica é (createdAt, id) crescente; os cursores são ids de
 * mensagem. Numa implementação SQL isso vira um índice em
 * (conversation_id, created_at, id) e `WHERE (created_at, id) < (...)`.
 */
export interface MessageRepository {
  create(data: CreateMessageData): Promise<ChatMessage>

  /** `null` quando o cursor (before/after/around) não existe na conversa. */
  findPage(
    conversationId: string,
    query: MessagesQuery
  ): Promise<MessagePage | null>
}

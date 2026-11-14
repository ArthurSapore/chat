import type {
  ChatMessage,
  MessagePage,
  MessageReaction,
  MessagesQuery,
  ReplyPreview,
} from "@workspace/contracts"

export interface CreateMessageData {
  conversationId: string
  senderId: string
  content: string
  replyTo: ReplyPreview | null
  clientId: string | null
}

/** Campos que podem mudar depois do envio. */
export interface UpdateMessageData {
  content?: string
  editedAt?: string
  reactions?: MessageReaction[]
}

/**
 * Porta de persistência das mensagens.
 *
 * A ordem canônica é (createdAt, id) crescente; os cursores são ids de
 * mensagem. Numa implementação SQL isso vira um índice em
 * (conversation_id, created_at, id) e `WHERE (created_at, id) < (...)`.
 * Reações seriam uma tabela própria com chave única (message_id, user_id).
 */
export interface MessageRepository {
  create(data: CreateMessageData): Promise<ChatMessage>

  findById(id: string): Promise<ChatMessage | null>

  /** Mensagem já enviada com este clientId (para reenvio idempotente). */
  findByClientId(
    conversationId: string,
    senderId: string,
    clientId: string
  ): Promise<ChatMessage | null>

  /** `null` quando a mensagem não existe. */
  update(id: string, data: UpdateMessageData): Promise<ChatMessage | null>

  /** `null` quando o cursor (before/after/around) não existe na conversa. */
  findPage(
    conversationId: string,
    query: MessagesQuery
  ): Promise<MessagePage | null>
}

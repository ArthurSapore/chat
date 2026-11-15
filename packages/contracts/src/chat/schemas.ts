import { z } from "zod"

import { idSchema, isoDateStringSchema } from "../common"

export const MESSAGE_MAX_LENGTH = 4000
export const MESSAGES_PAGE_DEFAULT_LIMIT = 40
export const MESSAGES_PAGE_MAX_LIMIT = 100
/** Prazo para o autor editar uma mensagem, contado a partir do envio. */
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60_000
/** Tamanho máximo do trecho citado guardado numa resposta. */
export const REPLY_PREVIEW_MAX_LENGTH = 200

/* -------------------------------- entidades ------------------------------- */

export const reactionTypes = [
  "like",
  "love",
  "laugh",
  "wow",
  "sad",
  "dislike",
] as const
export const reactionTypeSchema = z.enum(reactionTypes)
export type ReactionType = z.infer<typeof reactionTypeSchema>

/** Cada usuário tem no máximo uma reação por mensagem. */
export const messageReactionSchema = z.object({
  userId: idSchema,
  type: reactionTypeSchema,
})
export type MessageReaction = z.infer<typeof messageReactionSchema>

/**
 * Cópia do trecho citado no momento da resposta: a citação aparece mesmo que
 * a mensagem original não esteja carregada.
 */
export const replyPreviewSchema = z.object({
  id: idSchema,
  senderId: idSchema,
  content: z.string(),
})
export type ReplyPreview = z.infer<typeof replyPreviewSchema>

/**
 * Origem de uma mensagem encaminhada. Mensagens encaminhadas não podem ser
 * editadas (o conteúdo é de outra pessoa/conversa).
 */
export const forwardedFromSchema = z.object({
  messageId: idSchema,
  conversationId: idSchema,
  senderId: idSchema,
})
export type ForwardedFrom = z.infer<typeof forwardedFromSchema>

export const chatMessageSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  senderId: idSchema,
  content: z.string(),
  createdAt: isoDateStringSchema,
  /** Preenchido quando o autor edita a mensagem. */
  editedAt: isoDateStringSchema.nullable(),
  replyTo: replyPreviewSchema.nullable(),
  reactions: z.array(messageReactionSchema),
  /**
   * Id gerado pelo cliente no envio. Permite trocar a mensagem otimista pela
   * confirmada e torna o reenvio idempotente.
   */
  clientId: z.string().nullable(),
  /** Preenchido quando a mensagem foi encaminhada de outra. */
  forwardedFrom: forwardedFromSchema.nullable(),
})
export type ChatMessage = z.infer<typeof chatMessageSchema>

/**
 * Até onde cada participante já recebeu e já leu a conversa. Os valores são o
 * `createdAt` da última mensagem entregue/lida: toda mensagem com
 * `createdAt <=` ao marcador conta como entregue/lida. Um registro por pessoa,
 * em vez de um recibo por mensagem.
 */
export const memberReceiptSchema = z.object({
  conversationId: idSchema,
  userId: idSchema,
  deliveredAt: isoDateStringSchema.nullable(),
  readAt: isoDateStringSchema.nullable(),
})
export type MemberReceipt = z.infer<typeof memberReceiptSchema>

/** Resposta do join: os marcadores de todos os participantes. */
export interface ConversationJoined {
  conversationId: string
  receipts: MemberReceipt[]
}

/** Se o prazo de edição ainda está aberto em `now`. */
export function isWithinEditWindow(createdAt: string, now = Date.now()) {
  return now - new Date(createdAt).getTime() <= MESSAGE_EDIT_WINDOW_MS
}

/**
 * Regras de edição que dependem só da mensagem (a autoria é checada à parte):
 * não pode ser encaminhada e precisa estar dentro do prazo.
 */
export function canEditMessage(
  message: Pick<ChatMessage, "createdAt" | "forwardedFrom">,
  now = Date.now()
) {
  return (
    message.forwardedFrom === null && isWithinEditWindow(message.createdAt, now)
  )
}

/* ------------------------------ socket: entrada ---------------------------- */

export const conversationRefSchema = z.object({
  conversationId: idSchema,
})
export type ConversationRef = z.infer<typeof conversationRefSchema>

const messageContentSchema = z
  .string()
  .trim()
  .min(1, "A mensagem não pode ser vazia")
  .max(MESSAGE_MAX_LENGTH)

export const sendMessageSchema = z.object({
  conversationId: idSchema,
  content: messageContentSchema,
  /** Mensagem que está sendo respondida (da mesma conversa). */
  replyToId: idSchema.optional(),
  /** Mesmo clientId em um reenvio devolve a mensagem já criada. */
  clientId: z.uuid().optional(),
})
export type SendMessageInput = z.infer<typeof sendMessageSchema>

/** "Recebi/li até esta mensagem" (inclusive). Marcadores só avançam. */
export const receiptUpdateSchema = z.object({
  conversationId: idSchema,
  messageId: idSchema,
})
export type ReceiptUpdateInput = z.infer<typeof receiptUpdateSchema>

export const editMessageSchema = z.object({
  messageId: idSchema,
  content: messageContentSchema,
})
export type EditMessageInput = z.infer<typeof editMessageSchema>

/**
 * Alterna a reação do usuário: tipo diferente substitui, mesmo tipo remove.
 */
export const reactToMessageSchema = z.object({
  messageId: idSchema,
  type: reactionTypeSchema,
})
export type ReactToMessageInput = z.infer<typeof reactToMessageSchema>

/* --------------------------- REST: histórico ------------------------------ */

/**
 * Paginação por cursor (o cursor é o id de uma mensagem):
 *   - sem cursor  → as N mais recentes
 *   - before=<id> → N anteriores a <id>  (rolar para cima)
 *   - after=<id>  → N posteriores a <id> (rolar para baixo / sincronizar)
 *   - around=<id> → janela centrada em <id> (pular até a mensagem)
 */
export const messagesQuerySchema = z
  .object({
    before: idSchema.optional(),
    after: idSchema.optional(),
    around: idSchema.optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MESSAGES_PAGE_MAX_LIMIT)
      .default(MESSAGES_PAGE_DEFAULT_LIMIT),
  })
  .refine(
    (q) =>
      [q.before, q.after, q.around].filter((c) => c !== undefined).length <= 1,
    { message: "Use apenas um entre before, after e around" }
  )
/** O que o servidor recebe (já validado, com defaults). */
export type MessagesQuery = z.output<typeof messagesQuerySchema>
/** O que o cliente envia na query string (tudo opcional). */
export interface MessagesQueryParams {
  before?: string
  after?: string
  around?: string
  limit?: number
}

/** DTO de `MESSAGE_ROUTES.listConversationMessages`. */
export interface ListConversationMessagesRequest extends MessagesQueryParams {
  conversationId: string
}

/* ------------------------- REST: info da mensagem ------------------------- */

/** DTO de `MESSAGE_ROUTES.getMessageInfo`. */
export interface GetMessageInfoRequest {
  conversationId: string
  messageId: string
}

/** Quando a mensagem chegou e foi lida por um destinatário (null = ainda não). */
export interface MessageRecipientInfo {
  userId: string
  deliveredAt: string | null
  readAt: string | null
}

/** "Info" de uma mensagem: só o autor pode consultar. */
export interface MessageInfo {
  messageId: string
  sentAt: string
  recipients: MessageRecipientInfo[]
}

export const messagePageSchema = z.object({
  items: z.array(chatMessageSchema),
  hasOlder: z.boolean(),
  hasNewer: z.boolean(),
})
export type MessagePage = z.infer<typeof messagePageSchema>

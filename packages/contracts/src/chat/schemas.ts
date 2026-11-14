import { z } from "zod"

import { idSchema, isoDateStringSchema } from "../common"

export const MESSAGE_MAX_LENGTH = 4000
export const MESSAGES_PAGE_DEFAULT_LIMIT = 40
export const MESSAGES_PAGE_MAX_LIMIT = 100

/* -------------------------------- entidades ------------------------------- */

export const chatMessageSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  senderId: idSchema,
  content: z.string(),
  createdAt: isoDateStringSchema,
})
export type ChatMessage = z.infer<typeof chatMessageSchema>

/* ------------------------------ socket: entrada ---------------------------- */

export const conversationRefSchema = z.object({
  conversationId: idSchema,
})
export type ConversationRef = z.infer<typeof conversationRefSchema>

export const sendMessageSchema = z.object({
  conversationId: idSchema,
  content: z
    .string()
    .trim()
    .min(1, "A mensagem não pode ser vazia")
    .max(MESSAGE_MAX_LENGTH),
})
export type SendMessageInput = z.infer<typeof sendMessageSchema>

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

export const messagePageSchema = z.object({
  items: z.array(chatMessageSchema),
  hasOlder: z.boolean(),
  hasNewer: z.boolean(),
})
export type MessagePage = z.infer<typeof messagePageSchema>

import {
  isWithinEditWindow,
  REPLY_PREVIEW_MAX_LENGTH,
  type ChatMessage,
  type EditMessageInput,
  type MessagePage,
  type MessagesQuery,
  type ReactToMessageInput,
  type ReplyPreview,
  type SendMessageInput,
} from "@workspace/contracts"

import type { ConversationService } from "@/modules/conversations/conversation-service"
import type { MessageRepository } from "@/modules/messages/message-repository"
import { AppError } from "@/shared/errors"

export class MessageService {
  constructor(
    private readonly messages: MessageRepository,
    private readonly conversationService: ConversationService
  ) {}

  async send(senderId: string, input: SendMessageInput): Promise<ChatMessage> {
    await this.conversationService.assertMember(input.conversationId, senderId)

    // Reenvio (ex.: o ack se perdeu): devolve a mesma mensagem, sem duplicar.
    if (input.clientId) {
      const existing = await this.messages.findByClientId(
        input.conversationId,
        senderId,
        input.clientId
      )
      if (existing) return existing
    }

    const replyTo = input.replyToId
      ? await this.buildReplyPreview(input.conversationId, input.replyToId)
      : null

    return this.messages.create({
      conversationId: input.conversationId,
      senderId,
      content: input.content,
      replyTo,
      clientId: input.clientId ?? null,
    })
  }

  /** Só o autor edita, e só dentro do prazo (MESSAGE_EDIT_WINDOW_MS). */
  async edit(userId: string, input: EditMessageInput): Promise<ChatMessage> {
    const message = await this.findAccessible(userId, input.messageId)

    if (message.senderId !== userId) {
      throw AppError.forbidden("Só o autor pode editar a mensagem")
    }
    if (!isWithinEditWindow(message.createdAt)) {
      throw AppError.forbidden(
        "O prazo de 15 minutos para editar esta mensagem expirou"
      )
    }
    if (message.content === input.content) return message

    return this.updateOrFail(message.id, {
      content: input.content,
      editedAt: new Date().toISOString(),
    })
  }

  /**
   * Uma reação por usuário: tipo diferente substitui a anterior, o mesmo tipo
   * remove.
   */
  async react(
    userId: string,
    input: ReactToMessageInput
  ): Promise<ChatMessage> {
    const message = await this.findAccessible(userId, input.messageId)

    const current = message.reactions.find((r) => r.userId === userId)
    const others = message.reactions.filter((r) => r.userId !== userId)
    const reactions =
      current?.type === input.type
        ? others
        : [...others, { userId, type: input.type }]

    return this.updateOrFail(message.id, { reactions })
  }

  async list(
    userId: string,
    conversationId: string,
    query: MessagesQuery
  ): Promise<MessagePage> {
    await this.conversationService.assertMember(conversationId, userId)

    const page = await this.messages.findPage(conversationId, query)
    if (!page) throw AppError.notFound("Mensagem de referência não encontrada")

    return page
  }

  /** Mensagem existente numa conversa da qual o usuário participa. */
  private async findAccessible(userId: string, messageId: string) {
    const message = await this.messages.findById(messageId)
    if (!message) throw AppError.notFound("Mensagem não encontrada")

    await this.conversationService.assertMember(message.conversationId, userId)
    return message
  }

  private async buildReplyPreview(
    conversationId: string,
    replyToId: string
  ): Promise<ReplyPreview> {
    const original = await this.messages.findById(replyToId)
    // Mesma resposta para "não existe" e "é de outra conversa": não revela nada.
    if (!original || original.conversationId !== conversationId) {
      throw AppError.notFound("Mensagem respondida não encontrada")
    }

    return {
      id: original.id,
      senderId: original.senderId,
      content: original.content.slice(0, REPLY_PREVIEW_MAX_LENGTH),
    }
  }

  private async updateOrFail(
    id: string,
    data: Parameters<MessageRepository["update"]>[1]
  ) {
    const updated = await this.messages.update(id, data)
    if (!updated) throw AppError.notFound("Mensagem não encontrada")
    return updated
  }
}

import type { MemberReceipt, ReceiptUpdateInput } from "@workspace/contracts"

import type { Conversation } from "@/modules/conversations/conversation-repository"
import type { ConversationService } from "@/modules/conversations/conversation-service"
import type { MessageRepository } from "@/modules/messages/message-repository"
import type { ReceiptRepository } from "@/modules/receipts/receipt-repository"
import { AppError } from "@/shared/errors"

/** O mais recente entre dois ISO (mesmo formato → comparação de string). */
const latest = (a: string | null, b: string | null) =>
  a === null ? b : b === null ? a : a > b ? a : b

export class ReceiptService {
  constructor(
    private readonly receipts: ReceiptRepository,
    private readonly messages: MessageRepository,
    private readonly conversationService: ConversationService
  ) {}

  /** Marcadores de todos os participantes (quem nunca recebeu nada vem nulo). */
  async listFor(conversation: Conversation): Promise<MemberReceipt[]> {
    const saved = await this.receipts.listByConversation(conversation.id)
    const byUser = new Map(saved.map((r) => [r.userId, r]))

    return conversation.memberIds.map(
      (userId) => byUser.get(userId) ?? emptyReceipt(conversation.id, userId)
    )
  }

  /** Devolve o marcador atualizado, ou `null` se ele não avançou. */
  markDelivered(userId: string, input: ReceiptUpdateInput) {
    return this.advance(userId, input, "delivered")
  }

  /** Ler implica ter recebido: avança os dois marcadores. */
  markRead(userId: string, input: ReceiptUpdateInput) {
    return this.advance(userId, input, "read")
  }

  private async advance(
    userId: string,
    { conversationId, messageId }: ReceiptUpdateInput,
    kind: "delivered" | "read"
  ): Promise<MemberReceipt | null> {
    await this.conversationService.assertMember(conversationId, userId)

    const message = await this.messages.findById(messageId)
    if (!message || message.conversationId !== conversationId) {
      throw AppError.notFound("Mensagem não encontrada")
    }

    const current =
      (await this.receipts.find(conversationId, userId)) ??
      emptyReceipt(conversationId, userId)

    const readAt =
      kind === "read"
        ? latest(current.readAt, message.createdAt)
        : current.readAt
    const deliveredAt = latest(
      latest(current.deliveredAt, message.createdAt),
      readAt
    )

    if (deliveredAt === current.deliveredAt && readAt === current.readAt) {
      return null
    }

    return this.receipts.save({ ...current, deliveredAt, readAt })
  }
}

function emptyReceipt(conversationId: string, userId: string): MemberReceipt {
  return { conversationId, userId, deliveredAt: null, readAt: null }
}

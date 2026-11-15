import type {
  GetMessageInfoRequest,
  MemberReceipt,
  MessageInfo,
  ReceiptUpdateInput,
} from "@workspace/contracts"

import type { Conversation } from "@/modules/conversations/conversation-repository"
import type { ConversationService } from "@/modules/conversations/conversation-service"
import type { MessageRepository } from "@/modules/messages/message-repository"
import type {
  ReceiptHistoryEntry,
  ReceiptRepository,
} from "@/modules/receipts/receipt-repository"
import { AppError } from "@/shared/errors"

/** O mais recente entre dois ISO (mesmo formato → comparação de string). */
const latest = (a: string | null, b: string | null) =>
  a === null ? b : b === null ? a : a > b ? a : b

/** Quando o marcador alcançou `createdAt` pela primeira vez (ou null). */
function firstReached(
  history: ReceiptHistoryEntry[],
  marker: "deliveredAt" | "readAt",
  createdAt: string
) {
  const entry = history.find((h) => {
    const value = h[marker]
    return value !== null && value >= createdAt
  })
  return entry?.changedAt ?? null
}

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

  /**
   * "Info" da mensagem: quando foi enviada e, para cada destinatário, quando
   * chegou e quando foi lida. Só o autor pode consultar.
   */
  async getMessageInfo(
    userId: string,
    { conversationId, messageId }: GetMessageInfoRequest
  ): Promise<MessageInfo> {
    const conversation = await this.conversationService.assertMember(
      conversationId,
      userId
    )

    const message = await this.messages.findById(messageId)
    if (!message || message.conversationId !== conversationId) {
      throw AppError.notFound("Mensagem não encontrada")
    }
    if (message.senderId !== userId) {
      throw AppError.forbidden("Só o autor pode ver as informações da mensagem")
    }

    const recipientIds = conversation.memberIds.filter(
      (id) => id !== message.senderId
    )
    const recipients = await Promise.all(
      recipientIds.map(async (recipientId) => {
        const history = await this.receipts.listHistory(
          conversationId,
          recipientId
        )
        return {
          userId: recipientId,
          deliveredAt: firstReached(history, "deliveredAt", message.createdAt),
          readAt: firstReached(history, "readAt", message.createdAt),
        }
      })
    )

    return { messageId: message.id, sentAt: message.createdAt, recipients }
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

    const saved = await this.receipts.save({ ...current, deliveredAt, readAt })
    // Guarda quando o marcador avançou, para o "info" de cada mensagem.
    await this.receipts.appendHistory({
      ...saved,
      changedAt: new Date().toISOString(),
    })
    return saved
  }
}

function emptyReceipt(conversationId: string, userId: string): MemberReceipt {
  return { conversationId, userId, deliveredAt: null, readAt: null }
}

import type { MemberReceipt } from "@workspace/contracts"

import type { ReceiptRepository } from "@/modules/receipts/receipt-repository"

const keyOf = (conversationId: string, userId: string) =>
  `${conversationId}::${userId}`

export class InMemoryReceiptRepository implements ReceiptRepository {
  private readonly items = new Map<string, MemberReceipt>()

  constructor(seed: MemberReceipt[] = []) {
    for (const receipt of seed) {
      this.items.set(keyOf(receipt.conversationId, receipt.userId), receipt)
    }
  }

  async listByConversation(conversationId: string) {
    return [...this.items.values()].filter(
      (r) => r.conversationId === conversationId
    )
  }

  async find(conversationId: string, userId: string) {
    return this.items.get(keyOf(conversationId, userId)) ?? null
  }

  async save(receipt: MemberReceipt) {
    this.items.set(keyOf(receipt.conversationId, receipt.userId), receipt)
    return receipt
  }
}

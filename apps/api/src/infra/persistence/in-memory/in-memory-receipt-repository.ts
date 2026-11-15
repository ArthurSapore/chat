import type { MemberReceipt } from "@workspace/contracts"

import type {
  ReceiptHistoryEntry,
  ReceiptRepository,
} from "@/modules/receipts/receipt-repository"

const keyOf = (conversationId: string, userId: string) =>
  `${conversationId}::${userId}`

export class InMemoryReceiptRepository implements ReceiptRepository {
  private readonly items = new Map<string, MemberReceipt>()
  private readonly history = new Map<string, ReceiptHistoryEntry[]>()

  constructor(
    seed: MemberReceipt[] = [],
    historySeed: ReceiptHistoryEntry[] = []
  ) {
    for (const receipt of seed) {
      this.items.set(keyOf(receipt.conversationId, receipt.userId), receipt)
    }
    for (const entry of historySeed) this.historyOf(entry).push(entry)
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

  async appendHistory(entry: ReceiptHistoryEntry) {
    this.historyOf(entry).push(entry)
  }

  async listHistory(conversationId: string, userId: string) {
    return [...(this.history.get(keyOf(conversationId, userId)) ?? [])]
  }

  private historyOf({ conversationId, userId }: MemberReceipt) {
    const key = keyOf(conversationId, userId)
    let list = this.history.get(key)
    if (!list) {
      list = []
      this.history.set(key, list)
    }
    return list
  }
}

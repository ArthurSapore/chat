import { describe, expect, it } from "vitest"

import { InMemoryReceiptRepository } from "@/infra/persistence/in-memory/in-memory-receipt-repository"
import { makeReceipt } from "@/test/factories"

describe("InMemoryReceiptRepository", () => {
  it("saves and finds a receipt by conversation and user", async () => {
    const sut = new InMemoryReceiptRepository()
    const receipt = makeReceipt({ deliveredAt: "2026-01-01T10:00:00.000Z" })

    await sut.save(receipt)

    await expect(sut.find("conv-1", "user-b")).resolves.toEqual(receipt)
    await expect(sut.find("conv-1", "user-a")).resolves.toBeNull()
  })

  it("replaces the previous receipt of the same user", async () => {
    const sut = new InMemoryReceiptRepository([makeReceipt()])
    const next = makeReceipt({ readAt: "2026-01-01T10:00:00.000Z" })

    await sut.save(next)

    await expect(sut.listByConversation("conv-1")).resolves.toEqual([next])
  })

  it("appends and lists the history per conversation and user, in order", async () => {
    const first = { ...makeReceipt(), changedAt: "2026-01-01T10:00:00.000Z" }
    const second = { ...makeReceipt(), changedAt: "2026-01-01T10:01:00.000Z" }
    const sut = new InMemoryReceiptRepository([], [first])

    await sut.appendHistory(second)
    await sut.appendHistory({ ...second, userId: "user-a" })

    await expect(sut.listHistory("conv-1", "user-b")).resolves.toEqual([
      first,
      second,
    ])
  })

  it("lists only the receipts of the requested conversation", async () => {
    const sut = new InMemoryReceiptRepository([
      makeReceipt({ conversationId: "conv-1" }),
      makeReceipt({ conversationId: "conv-2" }),
    ])

    const result = await sut.listByConversation("conv-2")

    expect(result).toHaveLength(1)
    expect(result[0]?.conversationId).toBe("conv-2")
  })
})

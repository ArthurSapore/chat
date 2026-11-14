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

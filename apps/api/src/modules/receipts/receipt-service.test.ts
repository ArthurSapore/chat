import { describe, expect, it, vi } from "vitest"

import type { ConversationService } from "@/modules/conversations/conversation-service"
import type { MessageRepository } from "@/modules/messages/message-repository"
import type { ReceiptRepository } from "@/modules/receipts/receipt-repository"
import { ReceiptService } from "@/modules/receipts/receipt-service"
import { AppError } from "@/shared/errors"
import { makeConversation, makeMessage, makeReceipt } from "@/test/factories"

const T1 = "2026-01-01T10:00:00.000Z"
const T2 = "2026-01-01T10:05:00.000Z"

function makeSut() {
  const receipts = {
    listByConversation: vi.fn().mockResolvedValue([]),
    find: vi.fn().mockResolvedValue(null),
    save: vi.fn(async (receipt) => receipt),
  } satisfies ReceiptRepository

  const messages = {
    findById: vi.fn(),
  }

  const conversationService = {
    assertMember: vi.fn().mockResolvedValue(makeConversation()),
  }

  const sut = new ReceiptService(
    receipts,
    messages as unknown as MessageRepository,
    conversationService as unknown as ConversationService
  )
  return { sut, receipts, messages, conversationService }
}

describe("ReceiptService", () => {
  describe("listFor", () => {
    it("returns one receipt per member, empty for those without one", async () => {
      const { sut, receipts } = makeSut()
      const saved = makeReceipt({
        userId: "user-b",
        readAt: T1,
        deliveredAt: T1,
      })
      receipts.listByConversation.mockResolvedValue([saved])

      const result = await sut.listFor(makeConversation())

      expect(result).toEqual([makeReceipt({ userId: "user-a" }), saved])
    })
  })

  describe("markDelivered", () => {
    it("advances the delivered marker up to the message", async () => {
      const { sut, receipts, messages } = makeSut()
      messages.findById.mockResolvedValue(makeMessage({ createdAt: T1 }))

      const result = await sut.markDelivered("user-b", {
        conversationId: "conv-1",
        messageId: "msg-1",
      })

      expect(result).toEqual(makeReceipt({ deliveredAt: T1, readAt: null }))
      expect(receipts.save).toHaveBeenCalledWith(result)
    })

    it("does not move the marker back to an older message", async () => {
      const { sut, receipts, messages } = makeSut()
      receipts.find.mockResolvedValue(makeReceipt({ deliveredAt: T2 }))
      messages.findById.mockResolvedValue(makeMessage({ createdAt: T1 }))

      const result = await sut.markDelivered("user-b", {
        conversationId: "conv-1",
        messageId: "msg-1",
      })

      expect(result).toBeNull()
      expect(receipts.save).not.toHaveBeenCalled()
    })

    it("returns null when the marker is already at the message (repeated)", async () => {
      const { sut, receipts, messages } = makeSut()
      receipts.find.mockResolvedValue(makeReceipt({ deliveredAt: T1 }))
      messages.findById.mockResolvedValue(makeMessage({ createdAt: T1 }))

      await expect(
        sut.markDelivered("user-b", {
          conversationId: "conv-1",
          messageId: "msg-1",
        })
      ).resolves.toBeNull()
    })
  })

  describe("markRead", () => {
    it("advances read and delivered together (reading implies receiving)", async () => {
      const { sut, messages } = makeSut()
      messages.findById.mockResolvedValue(makeMessage({ createdAt: T2 }))

      const result = await sut.markRead("user-b", {
        conversationId: "conv-1",
        messageId: "msg-1",
      })

      expect(result).toEqual(makeReceipt({ deliveredAt: T2, readAt: T2 }))
    })

    it("keeps delivered when it is already ahead of read", async () => {
      const { sut, receipts, messages } = makeSut()
      receipts.find.mockResolvedValue(
        makeReceipt({ deliveredAt: T2, readAt: null })
      )
      messages.findById.mockResolvedValue(makeMessage({ createdAt: T1 }))

      const result = await sut.markRead("user-b", {
        conversationId: "conv-1",
        messageId: "msg-1",
      })

      expect(result).toEqual(makeReceipt({ deliveredAt: T2, readAt: T1 }))
    })
  })

  describe("validation", () => {
    it.each([
      ["does not exist", null],
      ["belongs to another conversation", makeMessage({ conversationId: "conv-2" })],
    ])("throws NOT_FOUND when the message %s", async (_, message) => {
      const { sut, messages, receipts } = makeSut()
      messages.findById.mockResolvedValue(message)

      await expect(
        sut.markRead("user-b", { conversationId: "conv-1", messageId: "msg-1" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
      expect(receipts.save).not.toHaveBeenCalled()
    })

    it("throws the membership error without looking up the message", async () => {
      const { sut, messages, conversationService } = makeSut()
      conversationService.assertMember.mockRejectedValue(AppError.forbidden())

      await expect(
        sut.markDelivered("intruder", {
          conversationId: "conv-1",
          messageId: "msg-1",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      expect(messages.findById).not.toHaveBeenCalled()
    })
  })
})

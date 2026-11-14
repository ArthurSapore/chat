import { describe, expect, it, vi } from "vitest"

import type { ConversationRepository } from "@/modules/conversations/conversation-repository"
import { ConversationService } from "@/modules/conversations/conversation-service"
import { AppError } from "@/shared/errors"
import { makeConversation } from "@/test/factories"

function makeSut() {
  const conversations = {
    findById: vi.fn(),
    isMember: vi.fn(),
  } satisfies ConversationRepository

  return { sut: new ConversationService(conversations), conversations }
}

describe("ConversationService", () => {
  describe("assertMember", () => {
    it("returns the conversation when the user is a member", async () => {
      const { sut, conversations } = makeSut()
      const conversation = makeConversation()
      conversations.findById.mockResolvedValue(conversation)
      conversations.isMember.mockResolvedValue(true)

      await expect(sut.assertMember("conv-1", "user-a")).resolves.toBe(
        conversation
      )
    })

    it("throws NOT_FOUND when the conversation does not exist", async () => {
      const { sut, conversations } = makeSut()
      conversations.findById.mockResolvedValue(null)

      await expect(sut.assertMember("conv-x", "user-a")).rejects.toMatchObject({
        code: "NOT_FOUND",
      })
      expect(conversations.isMember).not.toHaveBeenCalled()
    })

    it("throws FORBIDDEN when the user is not a member", async () => {
      const { sut, conversations } = makeSut()
      conversations.findById.mockResolvedValue(makeConversation())
      conversations.isMember.mockResolvedValue(false)

      const promise = sut.assertMember("conv-1", "intruder")

      await expect(promise).rejects.toBeInstanceOf(AppError)
      await expect(promise).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })
})

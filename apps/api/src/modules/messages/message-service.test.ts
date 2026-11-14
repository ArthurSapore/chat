import {
  MESSAGE_EDIT_WINDOW_MS,
  REPLY_PREVIEW_MAX_LENGTH,
} from "@workspace/contracts"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ConversationService } from "@/modules/conversations/conversation-service"
import type { MessageRepository } from "@/modules/messages/message-repository"
import { MessageService } from "@/modules/messages/message-service"
import { AppError } from "@/shared/errors"
import { makeConversation, makeMessage } from "@/test/factories"

function makeSut() {
  const messages = {
    create: vi.fn(),
    findById: vi.fn(),
    findByClientId: vi.fn(),
    update: vi.fn(),
    findPage: vi.fn(),
  } satisfies MessageRepository

  const conversationService = {
    assertMember: vi.fn().mockResolvedValue(makeConversation()),
  }

  // Like the real repository, update returns the message with the patch applied.
  messages.update.mockImplementation(async (id, data) => ({
    ...makeMessage({ id }),
    ...data,
  }))

  const sut = new MessageService(
    messages,
    conversationService as unknown as ConversationService
  )
  return { sut, messages, conversationService }
}

afterEach(() => {
  vi.useRealTimers()
})

describe("MessageService", () => {
  describe("send", () => {
    it("checks membership and creates the message", async () => {
      const { sut, messages, conversationService } = makeSut()
      const created = makeMessage({ content: "Oi" })
      messages.create.mockResolvedValue(created)

      const result = await sut.send("user-a", {
        conversationId: "conv-1",
        content: "Oi",
      })

      expect(conversationService.assertMember).toHaveBeenCalledWith(
        "conv-1",
        "user-a"
      )
      expect(messages.create).toHaveBeenCalledWith({
        conversationId: "conv-1",
        senderId: "user-a",
        content: "Oi",
        replyTo: null,
        clientId: null,
      })
      expect(result).toBe(created)
    })

    it("creates nothing when the user is not a member of the conversation", async () => {
      const { sut, messages, conversationService } = makeSut()
      conversationService.assertMember.mockRejectedValue(AppError.forbidden())

      await expect(
        sut.send("intruder", { conversationId: "conv-1", content: "Oi" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      expect(messages.create).not.toHaveBeenCalled()
    })

    it("returns the existing message when the clientId was already used (resend)", async () => {
      const { sut, messages } = makeSut()
      const existing = makeMessage({ clientId: "client-1" })
      messages.findByClientId.mockResolvedValue(existing)

      const result = await sut.send("user-a", {
        conversationId: "conv-1",
        content: "Oi",
        clientId: "client-1",
      })

      expect(messages.findByClientId).toHaveBeenCalledWith(
        "conv-1",
        "user-a",
        "client-1"
      )
      expect(result).toBe(existing)
      expect(messages.create).not.toHaveBeenCalled()
    })

    it("stores a truncated preview of the replied message", async () => {
      const { sut, messages } = makeSut()
      const longContent = "x".repeat(REPLY_PREVIEW_MAX_LENGTH + 50)
      messages.findById.mockResolvedValue(
        makeMessage({ id: "orig", senderId: "user-b", content: longContent })
      )
      messages.create.mockResolvedValue(makeMessage())

      await sut.send("user-a", {
        conversationId: "conv-1",
        content: "Resposta",
        replyToId: "orig",
      })

      expect(messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: {
            id: "orig",
            senderId: "user-b",
            content: "x".repeat(REPLY_PREVIEW_MAX_LENGTH),
          },
        })
      )
    })

    it.each([
      ["does not exist", null],
      [
        "belongs to another conversation",
        makeMessage({ id: "orig", conversationId: "conv-2" }),
      ],
    ])(
      "throws NOT_FOUND when the replied message %s",
      async (_, original) => {
        const { sut, messages } = makeSut()
        messages.findById.mockResolvedValue(original)

        await expect(
          sut.send("user-a", {
            conversationId: "conv-1",
            content: "Resposta",
            replyToId: "orig",
          })
        ).rejects.toMatchObject({ code: "NOT_FOUND" })
        expect(messages.create).not.toHaveBeenCalled()
      }
    )
  })

  describe("edit", () => {
    const createdAt = "2026-01-01T10:00:00.000Z"
    const sentAt = new Date(createdAt).getTime()

    it("updates the content and sets editedAt within the edit window", async () => {
      vi.useFakeTimers({ now: sentAt + 5 * 60_000 })
      const { sut, messages } = makeSut()
      messages.findById.mockResolvedValue(
        makeMessage({ senderId: "user-a", createdAt })
      )

      const result = await sut.edit("user-a", {
        messageId: "msg-1",
        content: "Editada",
      })

      expect(messages.update).toHaveBeenCalledWith("msg-1", {
        content: "Editada",
        editedAt: new Date(sentAt + 5 * 60_000).toISOString(),
      })
      expect(result.content).toBe("Editada")
    })

    it("accepts an edit exactly at the end of the window", async () => {
      vi.useFakeTimers({ now: sentAt + MESSAGE_EDIT_WINDOW_MS })
      const { sut, messages } = makeSut()
      messages.findById.mockResolvedValue(
        makeMessage({ senderId: "user-a", createdAt })
      )

      await expect(
        sut.edit("user-a", { messageId: "msg-1", content: "No limite" })
      ).resolves.toBeDefined()
    })

    it("throws FORBIDDEN after the edit window", async () => {
      vi.useFakeTimers({ now: sentAt + MESSAGE_EDIT_WINDOW_MS + 1 })
      const { sut, messages } = makeSut()
      messages.findById.mockResolvedValue(
        makeMessage({ senderId: "user-a", createdAt })
      )

      await expect(
        sut.edit("user-a", { messageId: "msg-1", content: "Tarde" })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: expect.stringContaining("15 minutos"),
      })
      expect(messages.update).not.toHaveBeenCalled()
    })

    it("throws FORBIDDEN when the editor is not the author", async () => {
      vi.useFakeTimers({ now: sentAt })
      const { sut, messages } = makeSut()
      messages.findById.mockResolvedValue(
        makeMessage({ senderId: "user-b", createdAt })
      )

      await expect(
        sut.edit("user-a", { messageId: "msg-1", content: "Hack" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      expect(messages.update).not.toHaveBeenCalled()
    })

    it("changes nothing when the content is the same", async () => {
      vi.useFakeTimers({ now: sentAt })
      const { sut, messages } = makeSut()
      const message = makeMessage({ senderId: "user-a", createdAt })
      messages.findById.mockResolvedValue(message)

      const result = await sut.edit("user-a", {
        messageId: "msg-1",
        content: message.content,
      })

      expect(result).toBe(message)
      expect(messages.update).not.toHaveBeenCalled()
    })

    it("throws NOT_FOUND when the message does not exist", async () => {
      const { sut, messages } = makeSut()
      messages.findById.mockResolvedValue(null)

      await expect(
        sut.edit("user-a", { messageId: "nope", content: "x" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
    })

    it("checks membership in the message's conversation", async () => {
      vi.useFakeTimers({ now: sentAt })
      const { sut, messages, conversationService } = makeSut()
      messages.findById.mockResolvedValue(
        makeMessage({ senderId: "user-a", conversationId: "conv-9", createdAt })
      )
      conversationService.assertMember.mockRejectedValue(AppError.forbidden())

      await expect(
        sut.edit("user-a", { messageId: "msg-1", content: "x" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      expect(conversationService.assertMember).toHaveBeenCalledWith(
        "conv-9",
        "user-a"
      )
    })
  })

  describe("react", () => {
    it("adds the user's reaction", async () => {
      const { sut, messages } = makeSut()
      messages.findById.mockResolvedValue(
        makeMessage({ reactions: [{ userId: "user-b", type: "love" }] })
      )

      await sut.react("user-a", { messageId: "msg-1", type: "like" })

      expect(messages.update).toHaveBeenCalledWith("msg-1", {
        reactions: [
          { userId: "user-b", type: "love" },
          { userId: "user-a", type: "like" },
        ],
      })
    })

    it("replaces the reaction when the type is different", async () => {
      const { sut, messages } = makeSut()
      messages.findById.mockResolvedValue(
        makeMessage({ reactions: [{ userId: "user-a", type: "like" }] })
      )

      await sut.react("user-a", { messageId: "msg-1", type: "laugh" })

      expect(messages.update).toHaveBeenCalledWith("msg-1", {
        reactions: [{ userId: "user-a", type: "laugh" }],
      })
    })

    it("removes the reaction when the type is the same", async () => {
      const { sut, messages } = makeSut()
      messages.findById.mockResolvedValue(
        makeMessage({
          reactions: [
            { userId: "user-a", type: "like" },
            { userId: "user-b", type: "like" },
          ],
        })
      )

      await sut.react("user-a", { messageId: "msg-1", type: "like" })

      expect(messages.update).toHaveBeenCalledWith("msg-1", {
        reactions: [{ userId: "user-b", type: "like" }],
      })
    })
  })

  describe("list", () => {
    it("returns the page from the repository", async () => {
      const { sut, messages } = makeSut()
      const page = { items: [makeMessage()], hasOlder: false, hasNewer: false }
      messages.findPage.mockResolvedValue(page)

      await expect(sut.list("user-a", "conv-1", { limit: 40 })).resolves.toBe(
        page
      )
      expect(messages.findPage).toHaveBeenCalledWith("conv-1", { limit: 40 })
    })

    it("throws NOT_FOUND when the cursor does not exist", async () => {
      const { sut, messages } = makeSut()
      messages.findPage.mockResolvedValue(null)

      await expect(
        sut.list("user-a", "conv-1", { before: "nope", limit: 40 })
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
    })
  })
})

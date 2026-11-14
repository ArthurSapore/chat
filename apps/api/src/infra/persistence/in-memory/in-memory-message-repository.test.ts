import { describe, expect, it } from "vitest"

import { InMemoryMessageRepository } from "@/infra/persistence/in-memory/in-memory-message-repository"
import { makeMessages } from "@/test/factories"

/** Page ids, for readable comparisons. */
const ids = (page: { items: { id: string }[] } | null) =>
  page?.items.map((m) => m.id)

function makeSut(count = 10) {
  return new InMemoryMessageRepository(makeMessages(count))
}

describe("InMemoryMessageRepository", () => {
  describe("findPage", () => {
    it("returns the most recent messages without a cursor", async () => {
      const page = await makeSut().findPage("conv-1", { limit: 3 })

      expect(ids(page)).toEqual(["m-8", "m-9", "m-10"])
      expect(page).toMatchObject({ hasOlder: true, hasNewer: false })
    })

    it("returns the messages before the cursor", async () => {
      const page = await makeSut().findPage("conv-1", {
        before: "m-5",
        limit: 3,
      })

      expect(ids(page)).toEqual(["m-2", "m-3", "m-4"])
      expect(page).toMatchObject({ hasOlder: true, hasNewer: true })
    })

    it("does not go past the start with before near the beginning", async () => {
      const page = await makeSut().findPage("conv-1", {
        before: "m-2",
        limit: 5,
      })

      expect(ids(page)).toEqual(["m-1"])
      expect(page?.hasOlder).toBe(false)
    })

    it("returns the messages after the cursor", async () => {
      const page = await makeSut().findPage("conv-1", {
        after: "m-8",
        limit: 5,
      })

      expect(ids(page)).toEqual(["m-9", "m-10"])
      expect(page).toMatchObject({ hasOlder: true, hasNewer: false })
    })

    it("centers the window on the cursor with around", async () => {
      const page = await makeSut().findPage("conv-1", {
        around: "m-5",
        limit: 3,
      })

      expect(ids(page)).toEqual(["m-4", "m-5", "m-6"])
    })

    it("shifts the around window to fit near the end", async () => {
      const page = await makeSut().findPage("conv-1", {
        around: "m-10",
        limit: 4,
      })

      expect(ids(page)).toEqual(["m-7", "m-8", "m-9", "m-10"])
      expect(page?.hasNewer).toBe(false)
    })

    it("returns null when the cursor does not exist", async () => {
      await expect(
        makeSut().findPage("conv-1", { before: "nope", limit: 3 })
      ).resolves.toBeNull()
    })

    it("returns an empty page for a conversation without messages", async () => {
      await expect(
        makeSut().findPage("conv-empty", { limit: 3 })
      ).resolves.toEqual({ items: [], hasOlder: false, hasNewer: false })
    })
  })

  describe("create", () => {
    it("appends to the conversation with default fields", async () => {
      const sut = makeSut(2)

      const created = await sut.create({
        conversationId: "conv-1",
        senderId: "user-a",
        content: "Nova",
        replyTo: null,
        clientId: "client-1",
      })

      expect(created).toMatchObject({
        id: expect.any(String),
        content: "Nova",
        editedAt: null,
        reactions: [],
        clientId: "client-1",
      })
      expect(ids(await sut.findPage("conv-1", { limit: 1 }))).toEqual([
        created.id,
      ])
    })
  })

  describe("findById / findByClientId / update", () => {
    it("finds a message by id", async () => {
      await expect(makeSut().findById("m-3")).resolves.toMatchObject({
        id: "m-3",
      })
      await expect(makeSut().findById("nope")).resolves.toBeNull()
    })

    it("finds by clientId only for the same sender", async () => {
      const sut = makeSut(1)
      const created = await sut.create({
        conversationId: "conv-1",
        senderId: "user-a",
        content: "Oi",
        replyTo: null,
        clientId: "client-1",
      })

      await expect(
        sut.findByClientId("conv-1", "user-a", "client-1")
      ).resolves.toEqual(created)
      await expect(
        sut.findByClientId("conv-1", "user-b", "client-1")
      ).resolves.toBeNull()
    })

    it("updates the message and reflects it in pages", async () => {
      const sut = makeSut(3)

      const updated = await sut.update("m-2", { content: "Editada" })

      expect(updated?.content).toBe("Editada")
      const page = await sut.findPage("conv-1", { limit: 3 })
      expect(page?.items[1]?.content).toBe("Editada")
    })

    it("returns null from update when the message does not exist", async () => {
      await expect(
        makeSut().update("nope", { content: "x" })
      ).resolves.toBeNull()
    })
  })
})

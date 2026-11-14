import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  expectNoEvent,
  nextEvent,
  startTestServer,
  TOKENS,
  type TestClient,
  type TestServer,
} from "@/test/test-server"

const CONVERSATION_ID = "conversation-123"

let server: TestServer

beforeEach(async () => {
  // The server logs connections/disconnections; silence them in tests.
  vi.spyOn(console, "log").mockImplementation(() => {})
  server = await startTestServer()
})

afterEach(async () => {
  await server.close()
  vi.restoreAllMocks()
})

/** Connects and joins the demo conversation. */
async function joined(token: string): Promise<TestClient> {
  const client = await server.connect(token)
  const ack = await client.emitWithAck("conversation:join", {
    conversationId: CONVERSATION_ID,
  })
  if (!ack.ok) throw new Error(`join failed: ${ack.error.message}`)
  return client
}

async function send(client: TestClient, content: string) {
  const ack = await client.emitWithAck("message:send", {
    conversationId: CONVERSATION_ID,
    content,
  })
  if (!ack.ok) throw new Error(`send failed: ${ack.error.message}`)
  return ack.data
}

describe("ChatGateway", () => {
  describe("authentication", () => {
    it("rejects the connection without a valid token", async () => {
      await expect(server.connect("fake-token")).rejects.toThrow("Unauthorized")
    })
  })

  describe("conversation:join", () => {
    it("joins the room and returns the receipts of every member", async () => {
      const ana = await server.connect(TOKENS.ana)

      const ack = await ana.emitWithAck("conversation:join", {
        conversationId: CONVERSATION_ID,
      })

      expect(ack.ok).toBe(true)
      if (!ack.ok) return
      expect(ack.data.conversationId).toBe(CONVERSATION_ID)
      expect(ack.data.receipts.map((r) => r.userId).sort()).toEqual([
        "example_user",
        "other_user",
      ])
    })

    it("acks NOT_FOUND for a nonexistent conversation", async () => {
      const ana = await server.connect(TOKENS.ana)

      const ack = await ana.emitWithAck("conversation:join", {
        conversationId: "does-not-exist",
      })

      expect(ack).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } })
    })

    it("acks VALIDATION_ERROR for an invalid payload", async () => {
      const ana = await server.connect(TOKENS.ana)

      const ack = await ana.emitWithAck("conversation:join", {
        conversationId: 42 as unknown as string,
      })

      expect(ack).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_ERROR" },
      })
    })
  })

  describe("message:send", () => {
    it("acks the sender and delivers message:new to members", async () => {
      const ana = await joined(TOKENS.ana)
      const bruno = await joined(TOKENS.bruno)
      const received = nextEvent(bruno, "message:new")

      const message = await send(ana, "  Oi, Bruno  ")

      expect(message).toMatchObject({
        senderId: "example_user",
        content: "Oi, Bruno",
      })
      await expect(received).resolves.toEqual(message)
    })

    it("is idempotent by clientId", async () => {
      const ana = await joined(TOKENS.ana)
      const clientId = randomUUID()
      const payload = {
        conversationId: CONVERSATION_ID,
        content: "Oi",
        clientId,
      }

      const first = await ana.emitWithAck("message:send", payload)
      const second = await ana.emitWithAck("message:send", payload)

      expect(first.ok && second.ok).toBe(true)
      if (first.ok && second.ok) expect(second.data.id).toBe(first.data.id)
    })

    it("does not deliver to a member who left the room", async () => {
      const ana = await joined(TOKENS.ana)
      const bruno = await joined(TOKENS.bruno)
      await bruno.emitWithAck("conversation:leave", {
        conversationId: CONVERSATION_ID,
      })

      await send(ana, "Alguém aí?")

      await expectNoEvent(bruno, "message:new")
    })
  })

  describe("message:edit and message:react", () => {
    it("broadcast the changed message with message:updated", async () => {
      const ana = await joined(TOKENS.ana)
      const bruno = await joined(TOKENS.bruno)
      const message = await send(ana, "Original")

      const edited = nextEvent(bruno, "message:updated")
      await ana.emitWithAck("message:edit", {
        messageId: message.id,
        content: "Editada",
      })
      await expect(edited).resolves.toMatchObject({
        id: message.id,
        content: "Editada",
        editedAt: expect.any(String),
      })

      const reacted = nextEvent(ana, "message:updated")
      await bruno.emitWithAck("message:react", {
        messageId: message.id,
        type: "love",
      })
      await expect(reacted).resolves.toMatchObject({
        reactions: [{ userId: "other_user", type: "love" }],
      })
    })

    it("rejects editing someone else's message", async () => {
      const ana = await joined(TOKENS.ana)
      const bruno = await joined(TOKENS.bruno)
      const message = await send(ana, "Minha")

      const ack = await bruno.emitWithAck("message:edit", {
        messageId: message.id,
        content: "Hack",
      })

      expect(ack).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } })
    })
  })

  describe("typing", () => {
    it("relays typing:start as user:typing to others", async () => {
      const ana = await joined(TOKENS.ana)
      const bruno = await joined(TOKENS.bruno)
      const typing = nextEvent(bruno, "user:typing")

      ana.emit("typing:start", { conversationId: CONVERSATION_ID })

      await expect(typing).resolves.toEqual({
        userId: "example_user",
        conversationId: CONVERSATION_ID,
      })
    })

    it("ignores typing from a socket that did not join the room", async () => {
      const ana = await server.connect(TOKENS.ana) // no join
      const bruno = await joined(TOKENS.bruno)

      ana.emit("typing:start", { conversationId: CONVERSATION_ID })

      await expectNoEvent(bruno, "user:typing")
    })

    it("emits user:stopped_typing when someone disconnects", async () => {
      const ana = await joined(TOKENS.ana)
      const bruno = await joined(TOKENS.bruno)
      const stopped = nextEvent(bruno, "user:stopped_typing")

      ana.disconnect()

      await expect(stopped).resolves.toMatchObject({ userId: "example_user" })
    })
  })

  describe("receipts", () => {
    it("broadcasts receipt:updated when the marker advances, without repeating", async () => {
      const ana = await joined(TOKENS.ana)
      const bruno = await joined(TOKENS.bruno)
      const message = await send(ana, "Chegou?")

      const delivered = nextEvent(ana, "receipt:updated")
      bruno.emit("conversation:delivered", {
        conversationId: CONVERSATION_ID,
        messageId: message.id,
      })
      await expect(delivered).resolves.toMatchObject({
        userId: "other_user",
        deliveredAt: message.createdAt,
      })

      bruno.emit("conversation:delivered", {
        conversationId: CONVERSATION_ID,
        messageId: message.id,
      })
      await expectNoEvent(ana, "receipt:updated")

      const read = nextEvent(ana, "receipt:updated")
      bruno.emit("conversation:read", {
        conversationId: CONVERSATION_ID,
        messageId: message.id,
      })
      await expect(read).resolves.toMatchObject({
        userId: "other_user",
        readAt: message.createdAt,
      })
    })

    it("returns the updated receipts on the next join", async () => {
      const ana = await joined(TOKENS.ana)
      const bruno = await joined(TOKENS.bruno)
      const message = await send(ana, "Leu?")
      const read = nextEvent(ana, "receipt:updated")
      bruno.emit("conversation:read", {
        conversationId: CONVERSATION_ID,
        messageId: message.id,
      })
      await read

      const reconnected = await server.connect(TOKENS.ana)
      const ack = await reconnected.emitWithAck("conversation:join", {
        conversationId: CONVERSATION_ID,
      })

      expect(ack.ok).toBe(true)
      if (!ack.ok) return
      expect(
        ack.data.receipts.find((r) => r.userId === "other_user")
      ).toMatchObject({ readAt: message.createdAt })
    })
  })
})

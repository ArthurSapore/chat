import type { ApiErrorBody, MessageInfo } from "@workspace/contracts"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { startTestServer, TOKENS, type TestServer } from "@/test/test-server"

// seed-0119 was sent by example_user (Ana); the seed history marks both
// members as having received and read it one minute after the last message.
const INFO = "/conversations/conversation-123/messages/seed-0119/info"
const SEED_READ_AT = "2026-01-01T02:00:00.000Z"

let server: TestServer

beforeEach(async () => {
  server = await startTestServer()
})

afterEach(async () => {
  await server.close()
})

describe("GET /conversations/:conversationId/messages/:messageId/info", () => {
  it("returns when the message was sent, delivered and read", async () => {
    const response = await server.request<MessageInfo>(INFO, TOKENS.ana)

    expect(response.status).toBe(200)
    expect(response.data).toEqual({
      messageId: "seed-0119",
      sentAt: "2026-01-01T01:58:00.000Z",
      recipients: [
        {
          userId: "other_user",
          deliveredAt: SEED_READ_AT,
          readAt: SEED_READ_AT,
        },
      ],
    })
  })

  it("responds 403 when the requester is not the author", async () => {
    const response = await server.request<ApiErrorBody>(INFO, TOKENS.bruno)

    expect(response.status).toBe(403)
    expect(response.data.error.code).toBe("FORBIDDEN")
  })

  it("responds 404 for a nonexistent message", async () => {
    const response = await server.request<ApiErrorBody>(
      "/conversations/conversation-123/messages/does-not-exist/info",
      TOKENS.ana
    )

    expect(response.status).toBe(404)
  })

  it("requires authentication", async () => {
    const response = await server.request(INFO)

    expect(response.status).toBe(401)
  })
})

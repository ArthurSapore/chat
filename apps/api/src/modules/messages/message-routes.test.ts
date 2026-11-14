import type { ApiErrorBody, MessagePage } from "@workspace/contracts"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { startTestServer, TOKENS, type TestServer } from "@/test/test-server"

const MESSAGES = "/conversations/conversation-123/messages"

let server: TestServer

beforeEach(async () => {
  server = await startTestServer()
})

afterEach(async () => {
  await server.close()
})

async function getPage(path: string) {
  const response = await server.request(path, TOKENS.ana)
  return {
    status: response.status,
    body: (await response.json()) as MessagePage,
  }
}

async function getError(path: string, token?: string) {
  const response = await server.request(path, token)
  return {
    status: response.status,
    body: (await response.json()) as ApiErrorBody,
  }
}

describe("GET /health", () => {
  it("responds ok without authentication", async () => {
    const response = await server.request("/health")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: "ok" })
  })
})

describe("GET /conversations/:conversationId/messages", () => {
  it("requires authentication", async () => {
    const { status, body } = await getError(MESSAGES)

    expect(status).toBe(401)
    expect(body.error.code).toBe("UNAUTHORIZED")
  })

  it("rejects an invalid token", async () => {
    const { status } = await getError(MESSAGES, "fake-token")

    expect(status).toBe(401)
  })

  it("returns the 40 most recent messages by default", async () => {
    const { status, body } = await getPage(MESSAGES)

    expect(status).toBe(200)
    expect(body.items).toHaveLength(40)
    expect(body.items[0]?.id).toBe("seed-0081")
    expect(body.items.at(-1)?.id).toBe("seed-0120")
    expect(body).toMatchObject({ hasOlder: true, hasNewer: false })
  })

  it("paginates with before and limit", async () => {
    const { body } = await getPage(`${MESSAGES}?before=seed-0081&limit=2`)

    expect(body.items.map((m) => m.id)).toEqual(["seed-0079", "seed-0080"])
    expect(body).toMatchObject({ hasOlder: true, hasNewer: true })
  })

  it.each([
    ["limit above the maximum", "?limit=999"],
    ["more than one cursor", "?before=seed-0010&after=seed-0020"],
    ["non-numeric limit", "?limit=abc"],
  ])("responds 400 for %s", async (_, query) => {
    const { status, body } = await getError(`${MESSAGES}${query}`, TOKENS.ana)

    expect(status).toBe(400)
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(body.error.details).toBeDefined()
  })

  it("responds 404 when the cursor does not exist", async () => {
    const { status, body } = await getError(
      `${MESSAGES}?before=nope`,
      TOKENS.ana
    )

    expect(status).toBe(404)
    expect(body.error.code).toBe("NOT_FOUND")
  })

  it("responds 404 for a nonexistent conversation", async () => {
    const { status } = await getError(
      "/conversations/does-not-exist/messages",
      TOKENS.ana
    )

    expect(status).toBe(404)
  })
})

describe("unknown routes", () => {
  it("respond 404 in the standard error format", async () => {
    const { status, body } = await getError("/route-that-does-not-exist", TOKENS.ana)

    expect(status).toBe(404)
    expect(body.error).toMatchObject({ code: "NOT_FOUND" })
  })
})

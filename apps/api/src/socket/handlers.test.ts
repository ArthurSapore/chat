import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { AppError } from "@/shared/errors"
import { withAck, withValidation } from "@/socket/handlers"

const schema = z.object({ name: z.string().min(1) })

afterEach(() => {
  vi.restoreAllMocks()
})

describe("withAck", () => {
  it("acks ok with the handler result and passes the validated payload", async () => {
    const handler = vi.fn(async ({ name }: { name: string }) => `hi ${name}`)
    const ack = vi.fn()

    await withAck(schema, handler)({ name: "Ana" }, ack)

    expect(handler).toHaveBeenCalledWith({ name: "Ana" })
    expect(ack).toHaveBeenCalledWith({ ok: true, data: "hi Ana" })
  })

  it("acks VALIDATION_ERROR without calling the handler when the payload is invalid", async () => {
    const handler = vi.fn()
    const ack = vi.fn()

    await withAck(schema, handler)({ name: "" }, ack)

    expect(handler).not.toHaveBeenCalled()
    expect(ack).toHaveBeenCalledWith({
      ok: false,
      error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
    })
  })

  it("converts an AppError thrown by the handler into an error ack", async () => {
    const ack = vi.fn()

    await withAck(schema, () => {
      throw AppError.forbidden("Não pode")
    })({ name: "Ana" }, ack)

    expect(ack).toHaveBeenCalledWith({
      ok: false,
      error: { code: "FORBIDDEN", message: "Não pode" },
    })
  })

  it("acks INTERNAL_ERROR and logs when the error is unexpected", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const ack = vi.fn()

    await withAck(schema, () => {
      throw new Error("boom")
    })({ name: "Ana" }, ack)

    expect(ack).toHaveBeenCalledWith({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" },
    })
    expect(consoleError).toHaveBeenCalled()
  })

  it("does not break when the client emits without a callback", async () => {
    const handler = vi.fn(() => "ok")

    await expect(
      withAck(schema, handler)({ name: "Ana" }, undefined)
    ).resolves.toBeUndefined()
    expect(handler).toHaveBeenCalled()
  })
})

describe("withValidation", () => {
  it("calls the handler with the validated payload", async () => {
    const handler = vi.fn()

    await withValidation(schema, handler)({ name: "Ana" })

    expect(handler).toHaveBeenCalledWith({ name: "Ana" })
  })

  it("drops an invalid payload without calling the handler", async () => {
    const handler = vi.fn()

    await withValidation(schema, handler)({ nome: "wrong" })

    expect(handler).not.toHaveBeenCalled()
  })

  it("swallows AppError silently and logs unexpected errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    await withValidation(schema, () => {
      throw AppError.notFound()
    })({ name: "Ana" })
    expect(consoleError).not.toHaveBeenCalled()

    await withValidation(schema, () => {
      throw new Error("boom")
    })({ name: "Ana" })
    expect(consoleError).toHaveBeenCalledTimes(1)
  })
})

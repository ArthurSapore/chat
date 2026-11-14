import { describe, expect, it } from "vitest"
import { z } from "zod"

import { AppError, toApiError } from "@/shared/errors"

describe("AppError", () => {
  it.each([
    ["unauthorized", AppError.unauthorized(), "UNAUTHORIZED", 401],
    ["forbidden", AppError.forbidden(), "FORBIDDEN", 403],
    ["notFound", AppError.notFound(), "NOT_FOUND", 404],
  ] as const)("%s uses code %s and status %i", (_, error, code, status) => {
    expect(error.code).toBe(code)
    expect(error.status).toBe(status)
  })

  it("validation keeps the flattened Zod errors in details", () => {
    const result = z.object({ name: z.string() }).safeParse({ name: 1 })
    if (result.success) throw new Error("expected a validation failure")

    const error = AppError.validation(result.error)

    expect(error.code).toBe("VALIDATION_ERROR")
    expect(error.status).toBe(400)
    expect(error.details).toMatchObject({
      fieldErrors: { name: expect.any(Array) },
    })
  })
})

describe("toApiError", () => {
  it("converts an AppError keeping code, message and status", () => {
    const result = toApiError(AppError.forbidden("Sem acesso"))

    expect(result).toEqual({
      status: 403,
      body: { code: "FORBIDDEN", message: "Sem acesso" },
      isUnexpected: false,
    })
  })

  it("converts a ZodError into VALIDATION_ERROR (400) with details", () => {
    const parsed = z.string().safeParse(42)
    if (parsed.success) throw new Error("expected a validation failure")

    const result = toApiError(parsed.error)

    expect(result.status).toBe(400)
    expect(result.body.code).toBe("VALIDATION_ERROR")
    expect(result.body.details).toBeDefined()
    expect(result.isUnexpected).toBe(false)
  })

  it("hides details of unexpected errors and flags them for logging", () => {
    const result = toApiError(new Error("database connection dropped"))

    expect(result).toEqual({
      status: 500,
      body: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" },
      isUnexpected: true,
    })
  })
})

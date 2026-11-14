import type { ApiError, ErrorCode } from "@workspace/contracts"
import { z } from "zod"

const httpStatusByCode: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
}

/** Erro esperado da aplicação: vira resposta para o cliente, não é "bug". */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown
  ) {
    super(message)
    this.name = "AppError"
  }

  get status() {
    return httpStatusByCode[this.code]
  }

  static unauthorized(message = "Não autenticado") {
    return new AppError("UNAUTHORIZED", message)
  }

  static forbidden(message = "Acesso negado") {
    return new AppError("FORBIDDEN", message)
  }

  static notFound(message = "Recurso não encontrado") {
    return new AppError("NOT_FOUND", message)
  }

  static validation(error: z.ZodError) {
    return new AppError(
      "VALIDATION_ERROR",
      "Dados inválidos",
      z.flattenError(error)
    )
  }
}

/**
 * Converte qualquer erro no formato público. Erros inesperados viram
 * INTERNAL_ERROR sem vazar detalhes; `isUnexpected` avisa para logar.
 */
export function toApiError(error: unknown): {
  status: number
  body: ApiError
  isUnexpected: boolean
} {
  const appError =
    error instanceof AppError
      ? error
      : error instanceof z.ZodError
        ? AppError.validation(error)
        : null

  if (appError) {
    return {
      status: appError.status,
      body: {
        code: appError.code,
        message: appError.message,
        ...(appError.details !== undefined && { details: appError.details }),
      },
      isUnexpected: false,
    }
  }

  return {
    status: 500,
    body: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" },
    isUnexpected: true,
  }
}

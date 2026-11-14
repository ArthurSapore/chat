import type { ApiErrorBody } from "@workspace/contracts"
import type { NextFunction, Request, Response } from "express"

import { AppError, toApiError } from "@/shared/errors"

export function notFoundHandler(req: Request) {
  throw AppError.notFound(`Rota não encontrada: ${req.method} ${req.path}`)
}

// O Express reconhece error handlers pela aridade (4 parâmetros).
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response<ApiErrorBody>,
  _next: NextFunction
) {
  const { status, body, isUnexpected } = toApiError(error)
  if (isUnexpected) console.error("[http] erro inesperado:", error)
  res.status(status).json({ error: body })
}

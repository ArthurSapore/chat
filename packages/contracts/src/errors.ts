export const errorCodes = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "INTERNAL_ERROR",
] as const

export type ErrorCode = (typeof errorCodes)[number]

/** Formato único de erro, usado tanto no HTTP quanto nos acks do socket. */
export interface ApiError {
  code: ErrorCode
  message: string
  details?: unknown
}

/** Corpo das respostas HTTP de erro. */
export interface ApiErrorBody {
  error: ApiError
}

/** Resposta de todo evento do socket que tem callback (ack). */
export type Ack<T> = { ok: true; data: T } | { ok: false; error: ApiError }

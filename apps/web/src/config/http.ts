import type { ApiError, ApiErrorBody } from "@workspace/contracts"
import axios from "axios"

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3000"

/** Erro com o mesmo formato que o servidor devolve (HTTP e socket). */
export class ApiRequestError extends Error {
  readonly code: ApiError["code"]
  readonly details?: unknown
  readonly status?: number

  constructor(error: ApiError, status?: number) {
    super(error.message)
    this.name = "ApiRequestError"
    this.code = error.code
    this.details = error.details
    this.status = status
  }
}

/**
 * Instância axios única do front: toda requisição passa por aqui, sempre via
 * `http.request(<DOMINIO>_ROUTES.<acao>(dto))` nos `service/requests.ts`.
 */
export const http = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
})

// Tratamento global de erros: converte qualquer falha HTTP no formato de erro
// da API. Cancelamentos (AbortController) seguem como estão, para quem chamou
// poder ignorá-los.
http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isCancel(error)) return Promise.reject(error)
    return Promise.reject(toApiRequestError(error))
  }
)

function toApiRequestError(error: unknown): ApiRequestError {
  if (!axios.isAxiosError<ApiErrorBody>(error)) {
    return new ApiRequestError({
      code: "INTERNAL_ERROR",
      message: "Erro inesperado",
    })
  }

  const status = error.response?.status
  const body = error.response?.data?.error
  if (body) return new ApiRequestError(body, status)

  return new ApiRequestError(
    {
      code: "INTERNAL_ERROR",
      message: status
        ? `Falha na requisição (${status})`
        : "Não foi possível conectar ao servidor",
    },
    status
  )
}

/**
 * Cabeçalho de autenticação de uma sessão. Não há interceptor de token
 * global porque cada chat da página tem o próprio usuário.
 */
export function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

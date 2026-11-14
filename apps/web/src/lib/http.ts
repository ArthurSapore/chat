import type { ApiError, ApiErrorBody } from "@workspace/contracts"

import { env } from "@/config/env"

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

type QueryValue = string | number | boolean | undefined

interface RequestOptions extends Omit<RequestInit, "body"> {
  /** Token de acesso da sessão que faz a requisição. */
  token: string
  query?: Record<string, QueryValue>
  body?: unknown
}

export async function apiFetch<T>(
  path: string,
  { token, query, body, headers, ...init }: RequestOptions
): Promise<T> {
  const url = new URL(path, env.API_URL)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => null)) as ApiErrorBody | null
    throw new ApiRequestError(
      payload?.error ?? {
        code: "INTERNAL_ERROR",
        message: `Falha na requisição (${response.status})`,
      },
      response.status
    )
  }

  return (await response.json()) as T
}

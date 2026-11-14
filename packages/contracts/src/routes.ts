
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

/** Erro padrão devolvido pela API (status 4xx/5xx). */
export interface ApiErrorBody {
  status: number
  message: string
}


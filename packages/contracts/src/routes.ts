
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export interface ApiErrorBody {
  status: number
  message: string
}


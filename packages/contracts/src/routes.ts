export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

/** Caminhos da API REST, compartilhados entre o servidor e o cliente. */
export const apiRoutes = {
  health: "/health",
  conversationMessages: {
    /** Padrão no formato do Express. */
    pattern: "/conversations/:conversationId/messages",
    build: (conversationId: string) =>
      `/conversations/${encodeURIComponent(conversationId)}/messages`,
  },
} as const

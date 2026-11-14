import { buildPath, type HttpRequestConfig } from "../routes"
import type { ListConversationMessagesRequest } from "./schemas"

/**
 * Padrões de caminho (formato do Express). A API registra as rotas com eles;
 * o front não usa diretamente — usa `MESSAGE_ROUTES`.
 */
export const MESSAGE_PATHS = {
  conversationMessages: "/conversations/:conversationId/messages",
} as const

/**
 * Requisições do domínio de mensagens: cada função recebe o DTO e devolve a
 * config pronta para `http.request()` no front.
 */
export const MESSAGE_ROUTES = {
  listConversationMessages({
    conversationId,
    ...params
  }: ListConversationMessagesRequest): HttpRequestConfig {
    return {
      method: "GET",
      url: buildPath(MESSAGE_PATHS.conversationMessages, { conversationId }),
      params,
    }
  },
} as const

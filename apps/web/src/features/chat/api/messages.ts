import {
  apiRoutes,
  type MessagePage,
  type MessagesQueryParams,
} from "@workspace/contracts"

import { apiFetch } from "@/lib/http"

export function fetchMessages(
  token: string,
  conversationId: string,
  query: MessagesQueryParams = {},
  signal?: AbortSignal
) {
  return apiFetch<MessagePage>(
    apiRoutes.conversationMessages.build(conversationId),
    { token, query: { ...query }, signal }
  )
}

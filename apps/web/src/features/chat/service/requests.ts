import {
  MESSAGE_ROUTES,
  type GetMessageInfoRequest,
  type ListConversationMessagesRequest,
  type MessageInfo,
  type MessagePage,
} from "@workspace/contracts"

import { authHeaders, http } from "@/config/http"

/** Quem faz a requisição (cada chat da página tem a própria sessão). */
export interface SessionRequestOptions {
  token: string
  signal?: AbortSignal
}

export async function listConversationMessagesRequest(
  dto: ListConversationMessagesRequest,
  { token, signal }: SessionRequestOptions
) {
  return http.request<MessagePage>({
    ...MESSAGE_ROUTES.listConversationMessages(dto),
    headers: authHeaders(token),
    signal,
  })
}

export async function getMessageInfoRequest(
  dto: GetMessageInfoRequest,
  { token, signal }: SessionRequestOptions
) {
  return http.request<MessageInfo>({
    ...MESSAGE_ROUTES.getMessageInfo(dto),
    headers: authHeaders(token),
    signal,
  })
}

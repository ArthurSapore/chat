import type { ChatMessage, MemberReceipt } from "@workspace/contracts"

import type { Conversation } from "@/modules/conversations/conversation-repository"

/** Test data with valid defaults; override only what matters. */
export function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "msg-1",
    conversationId: "conv-1",
    senderId: "user-a",
    content: "Olá",
    createdAt: "2026-01-01T10:00:00.000Z",
    editedAt: null,
    replyTo: null,
    reactions: [],
    clientId: null,
    ...overrides,
  }
}

export function makeConversation(
  overrides: Partial<Conversation> = {}
): Conversation {
  return {
    id: "conv-1",
    memberIds: ["user-a", "user-b"],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

export function makeReceipt(
  overrides: Partial<MemberReceipt> = {}
): MemberReceipt {
  return {
    conversationId: "conv-1",
    userId: "user-b",
    deliveredAt: null,
    readAt: null,
    ...overrides,
  }
}

/** N messages in order, one minute apart. */
export function makeMessages(count: number, conversationId = "conv-1") {
  return Array.from({ length: count }, (_, i) =>
    makeMessage({
      id: `m-${i + 1}`,
      conversationId,
      content: `Mensagem ${i + 1}`,
      createdAt: new Date(Date.UTC(2026, 0, 1, 10, i)).toISOString(),
    })
  )
}

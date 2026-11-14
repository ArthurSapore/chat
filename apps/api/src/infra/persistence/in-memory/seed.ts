import type { ChatMessage } from "@workspace/contracts"

import type { Conversation } from "@/modules/conversations/conversation-repository"

/** Dados de desenvolvimento enquanto não há banco. */
export const DEMO_CONVERSATION_ID = "conversation-123"
export const DEMO_USER_IDS = ["example_user", "other_user"] as const

const SEED_MESSAGES = 120

export const seedConversations: Conversation[] = [
  {
    id: DEMO_CONVERSATION_ID,
    memberIds: [...DEMO_USER_IDS],
    createdAt: new Date(Date.UTC(2026, 0, 1)).toISOString(),
  },
]

export const seedMessages: ChatMessage[] = Array.from(
  { length: SEED_MESSAGES },
  (_, i) => ({
    id: `seed-${String(i + 1).padStart(4, "0")}`,
    conversationId: DEMO_CONVERSATION_ID,
    senderId: DEMO_USER_IDS[i % DEMO_USER_IDS.length]!,
    content: `Mensagem de exemplo #${i + 1}`,
    createdAt: new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString(),
  })
)

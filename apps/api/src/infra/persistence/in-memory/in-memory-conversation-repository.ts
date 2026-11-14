import type {
  Conversation,
  ConversationRepository,
} from "@/modules/conversations/conversation-repository"

export class InMemoryConversationRepository implements ConversationRepository {
  private readonly items = new Map<string, Conversation>()

  constructor(seed: Conversation[] = []) {
    for (const conversation of seed) this.items.set(conversation.id, conversation)
  }

  async findById(id: string) {
    return this.items.get(id) ?? null
  }

  async isMember(conversationId: string, userId: string) {
    return this.items.get(conversationId)?.memberIds.includes(userId) ?? false
  }
}

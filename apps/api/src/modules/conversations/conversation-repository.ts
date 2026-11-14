export interface Conversation {
  id: string
  memberIds: string[]
  createdAt: string
}

/**
 * Porta de persistência das conversas. Os services dependem só desta
 * interface; a implementação (memória, Postgres...) é escolhida no container.
 */
export interface ConversationRepository {
  findById(id: string): Promise<Conversation | null>
  isMember(conversationId: string, userId: string): Promise<boolean>
}

import { InMemoryConversationRepository } from "@/infra/persistence/in-memory/in-memory-conversation-repository"
import { InMemoryMessageRepository } from "@/infra/persistence/in-memory/in-memory-message-repository"
import {
  seedConversations,
  seedMessages,
} from "@/infra/persistence/in-memory/seed"
import { AuthService } from "@/modules/auth/auth-service"
import { ConversationService } from "@/modules/conversations/conversation-service"
import { MessageService } from "@/modules/messages/message-service"

/**
 * Composition root: o único lugar que escolhe implementações concretas.
 * Para usar um banco, troque os repositórios in-memory aqui.
 */
export function createContainer() {
  const conversationRepository = new InMemoryConversationRepository(
    seedConversations
  )
  const messageRepository = new InMemoryMessageRepository(seedMessages)

  const authService = new AuthService()
  const conversationService = new ConversationService(conversationRepository)
  const messageService = new MessageService(
    messageRepository,
    conversationService
  )

  return { authService, conversationService, messageService }
}

export type Container = ReturnType<typeof createContainer>

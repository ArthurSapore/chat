import type { ConversationRepository } from "@/modules/conversations/conversation-repository"
import { AppError } from "@/shared/errors"

export class ConversationService {
  constructor(private readonly conversations: ConversationRepository) {}

  /**
   * Garante que a conversa existe e que o usuário participa dela.
   * Toda operação sobre uma conversa (entrar na sala, enviar, ler histórico)
   * passa por aqui.
   */
  async assertMember(conversationId: string, userId: string) {
    const conversation = await this.conversations.findById(conversationId)
    if (!conversation) throw AppError.notFound("Conversa não encontrada")

    const isMember = await this.conversations.isMember(conversationId, userId)
    if (!isMember) throw AppError.forbidden("Você não participa desta conversa")

    return conversation
  }
}

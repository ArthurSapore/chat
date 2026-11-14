import type {
  ChatMessage,
  MessagePage,
  MessagesQuery,
  SendMessageInput,
} from "@workspace/contracts"

import type { ConversationService } from "@/modules/conversations/conversation-service"
import type { MessageRepository } from "@/modules/messages/message-repository"
import { AppError } from "@/shared/errors"

export class MessageService {
  constructor(
    private readonly messages: MessageRepository,
    private readonly conversationService: ConversationService
  ) {}

  async send(senderId: string, input: SendMessageInput): Promise<ChatMessage> {
    await this.conversationService.assertMember(input.conversationId, senderId)

    return this.messages.create({
      conversationId: input.conversationId,
      senderId,
      content: input.content,
    })
  }

  async list(
    userId: string,
    conversationId: string,
    query: MessagesQuery
  ): Promise<MessagePage> {
    await this.conversationService.assertMember(conversationId, userId)

    const page = await this.messages.findPage(conversationId, query)
    if (!page) throw AppError.notFound("Mensagem de referência não encontrada")

    return page
  }
}

import type { ChatMessage } from "@workspace/contracts";
import { randomUUID } from "node:crypto";


export class ChatService {
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
  ): Promise<ChatMessage> {
    // Aqui entraria a validação da conversa
    // e a persistência no banco de dados.

    const message: ChatMessage = {
      id: randomUUID(),
      conversationId,
      senderId,
      content,
      createdAt: new Date().toISOString(),
    };

    return message;
  }
}
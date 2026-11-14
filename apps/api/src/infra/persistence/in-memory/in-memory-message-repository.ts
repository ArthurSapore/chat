import type {
  ChatMessage,
  MessagePage,
  MessagesQuery,
} from "@workspace/contracts"
import { randomUUID } from "node:crypto"

import type {
  CreateMessageData,
  MessageRepository,
} from "@/modules/messages/message-repository"

/**
 * Guarda as mensagens de cada conversa num array já na ordem canônica
 * (inserção = createdAt crescente). Serve para desenvolvimento e testes;
 * os dados somem ao reiniciar o processo.
 */
export class InMemoryMessageRepository implements MessageRepository {
  private readonly byConversation = new Map<string, ChatMessage[]>()

  constructor(seed: ChatMessage[] = []) {
    for (const message of seed) this.listOf(message.conversationId).push(message)
  }

  async create(data: CreateMessageData) {
    const message: ChatMessage = {
      id: randomUUID(),
      conversationId: data.conversationId,
      senderId: data.senderId,
      content: data.content,
      createdAt: new Date().toISOString(),
    }
    this.listOf(data.conversationId).push(message)
    return message
  }

  async findPage(
    conversationId: string,
    { before, after, around, limit }: MessagesQuery
  ): Promise<MessagePage | null> {
    const list = this.listOf(conversationId)
    const cursor = before ?? after ?? around

    if (cursor === undefined) {
      return slice(list, list.length - limit, list.length)
    }

    const index = list.findIndex((m) => m.id === cursor)
    if (index < 0) return null

    if (before !== undefined) return slice(list, index - limit, index)
    if (after !== undefined) return slice(list, index + 1, index + 1 + limit)

    const start = Math.max(
      0,
      Math.min(index - Math.floor(limit / 2), list.length - limit)
    )
    return slice(list, start, start + limit)
  }

  private listOf(conversationId: string) {
    let list = this.byConversation.get(conversationId)
    if (!list) {
      list = []
      this.byConversation.set(conversationId, list)
    }
    return list
  }
}

function slice(list: ChatMessage[], start: number, end: number): MessagePage {
  const s = Math.max(0, start)
  const e = Math.min(list.length, end)
  return {
    items: list.slice(s, e),
    hasOlder: s > 0,
    hasNewer: e < list.length,
  }
}

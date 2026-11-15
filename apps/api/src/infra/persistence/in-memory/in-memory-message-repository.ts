import type {
  ChatMessage,
  MessagePage,
  MessagesQuery,
} from "@workspace/contracts"
import { randomUUID } from "node:crypto"

import type {
  CreateMessageData,
  MessageRepository,
  UpdateMessageData,
} from "@/modules/messages/message-repository"

/**
 * Guarda as mensagens de cada conversa num array já na ordem canônica
 * (inserção = createdAt crescente). Serve para desenvolvimento e testes;
 * os dados somem ao reiniciar o processo.
 */
export class InMemoryMessageRepository implements MessageRepository {
  private readonly byConversation = new Map<string, ChatMessage[]>()
  /** id → conversationId, para achar uma mensagem sem varrer tudo. */
  private readonly conversationOf = new Map<string, string>()

  constructor(seed: ChatMessage[] = []) {
    for (const message of seed) this.insert(message)
  }

  async create(data: CreateMessageData) {
    const message: ChatMessage = {
      id: randomUUID(),
      conversationId: data.conversationId,
      senderId: data.senderId,
      content: data.content,
      createdAt: new Date().toISOString(),
      editedAt: null,
      replyTo: data.replyTo,
      reactions: [],
      clientId: data.clientId,
      forwardedFrom: data.forwardedFrom,
    }
    this.insert(message)
    return message
  }

  async findById(id: string) {
    const location = this.locate(id)
    return location ? location.list[location.index]! : null
  }

  async findByClientId(
    conversationId: string,
    senderId: string,
    clientId: string
  ) {
    return (
      this.listOf(conversationId).find(
        (m) => m.senderId === senderId && m.clientId === clientId
      ) ?? null
    )
  }

  async update(id: string, data: UpdateMessageData) {
    const location = this.locate(id)
    if (!location) return null

    const updated = { ...location.list[location.index]!, ...data }
    location.list[location.index] = updated
    return updated
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

  private insert(message: ChatMessage) {
    this.listOf(message.conversationId).push(message)
    this.conversationOf.set(message.id, message.conversationId)
  }

  private locate(id: string) {
    const conversationId = this.conversationOf.get(id)
    if (!conversationId) return null

    const list = this.listOf(conversationId)
    const index = list.findIndex((m) => m.id === id)
    return index < 0 ? null : { list, index }
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

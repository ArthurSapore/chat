import { conversationRefSchema, sendMessageSchema } from "@workspace/contracts"

import type { ConversationService } from "@/modules/conversations/conversation-service"
import type { MessageService } from "@/modules/messages/message-service"
import { withAck, withValidation } from "@/socket/handlers"
import { conversationIdFromRoom, conversationRoom } from "@/socket/rooms"
import type { ChatServer, ChatSocket } from "@/socket/types"

/**
 * Camada de transporte do chat: traduz eventos do socket em chamadas aos
 * services e faz o broadcast. Regra de negócio fica nos services.
 */
export class ChatGateway {
  constructor(
    private readonly io: ChatServer,
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService
  ) {}

  register(socket: ChatSocket) {
    const { userId } = socket.data

    socket.on(
      "conversation:join",
      withAck(conversationRefSchema, async ({ conversationId }) => {
        await this.conversationService.assertMember(conversationId, userId)
        await socket.join(conversationRoom(conversationId))
        return { conversationId }
      })
    )

    socket.on(
      "conversation:leave",
      withAck(conversationRefSchema, async ({ conversationId }) => {
        this.emitStoppedTyping(socket, conversationId)
        await socket.leave(conversationRoom(conversationId))
        return { conversationId }
      })
    )

    socket.on(
      "message:send",
      withAck(sendMessageSchema, async (input) => {
        const message = await this.messageService.send(userId, input)

        // Inclui o próprio remetente: outras abas dele também recebem.
        this.io
          .to(conversationRoom(message.conversationId))
          .emit("message:new", message)

        return message
      })
    )

    // Typing é efêmero e frequente: em vez de consultar o banco, só repassa
    // se o socket já entrou na sala (o join já validou a participação).
    socket.on(
      "typing:start",
      withValidation(conversationRefSchema, ({ conversationId }) => {
        const room = conversationRoom(conversationId)
        if (!socket.rooms.has(room)) return
        socket.to(room).emit("user:typing", { userId, conversationId })
      })
    )

    socket.on(
      "typing:stop",
      withValidation(conversationRefSchema, ({ conversationId }) => {
        this.emitStoppedTyping(socket, conversationId)
      })
    )

    // "disconnecting" ainda tem acesso às salas (em "disconnect" já saiu).
    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        const conversationId = conversationIdFromRoom(room)
        if (conversationId) this.emitStoppedTyping(socket, conversationId)
      }
    })
  }

  private emitStoppedTyping(socket: ChatSocket, conversationId: string) {
    const room = conversationRoom(conversationId)
    if (!socket.rooms.has(room)) return
    socket.to(room).emit("user:stopped_typing", {
      userId: socket.data.userId,
      conversationId,
    })
  }
}

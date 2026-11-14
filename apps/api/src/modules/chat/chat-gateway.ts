import {
  conversationRefSchema,
  editMessageSchema,
  reactToMessageSchema,
  receiptUpdateSchema,
  sendMessageSchema,
  type ChatMessage,
  type MemberReceipt,
} from "@workspace/contracts"

import type { ConversationService } from "@/modules/conversations/conversation-service"
import type { MessageService } from "@/modules/messages/message-service"
import type { ReceiptService } from "@/modules/receipts/receipt-service"
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
    private readonly messageService: MessageService,
    private readonly receiptService: ReceiptService
  ) {}

  register(socket: ChatSocket) {
    const { userId } = socket.data

    socket.on(
      "conversation:join",
      withAck(conversationRefSchema, async ({ conversationId }) => {
        const conversation = await this.conversationService.assertMember(
          conversationId,
          userId
        )
        await socket.join(conversationRoom(conversationId))
        // Os marcadores vêm junto: a cada (re)join o cliente se ressincroniza.
        const receipts = await this.receiptService.listFor(conversation)
        return { conversationId, receipts }
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

    socket.on(
      "message:edit",
      withAck(editMessageSchema, async (input) => {
        const message = await this.messageService.edit(userId, input)
        this.broadcastUpdated(message)
        return message
      })
    )

    socket.on(
      "message:react",
      withAck(reactToMessageSchema, async (input) => {
        const message = await this.messageService.react(userId, input)
        this.broadcastUpdated(message)
        return message
      })
    )

    // Recibos: frequentes e sem resposta. Só repassa quando o marcador avança.
    socket.on(
      "conversation:delivered",
      withValidation(receiptUpdateSchema, async (input) => {
        const receipt = await this.receiptService.markDelivered(userId, input)
        if (receipt) this.broadcastReceipt(receipt)
      })
    )

    socket.on(
      "conversation:read",
      withValidation(receiptUpdateSchema, async (input) => {
        const receipt = await this.receiptService.markRead(userId, input)
        if (receipt) this.broadcastReceipt(receipt)
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

  private broadcastUpdated(message: ChatMessage) {
    this.io
      .to(conversationRoom(message.conversationId))
      .emit("message:updated", message)
  }

  private broadcastReceipt(receipt: MemberReceipt) {
    this.io
      .to(conversationRoom(receipt.conversationId))
      .emit("receipt:updated", receipt)
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

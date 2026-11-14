import { Server, Socket } from "socket.io";

import { ChatService } from "@/modules/chat/chat-service";
import type { InterServerEvents, SocketData } from "@/modules/chat/types";
import type { ClientToServerEvents, ServerToClientEvents } from "@workspace/contracts";

type ChatServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type ChatSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export class ChatGateway {
  private chatService = new ChatService();

  constructor(
    private io: ChatServer,
    private socket: ChatSocket,
  ) {}

  registerListeners() {
    this.handleJoinConversation();
    this.handleSendMessage();
    this.handleTyping();
  }

  private handleJoinConversation() {
    this.socket.on("conversation:join", async ({ conversationId }, callback) => {
      // IMPORTANTE:
      // Validar se o usuário pertence à conversa
      // antes de permitir que ele entre na sala.

      await this.socket.join(conversationId);

      callback({ success: true });
    });
  }

  private handleSendMessage() {
    this.socket.on(
      "message:send",
      async ({ conversationId, content }, callback) => {
        try {
          console.log(content)

          if (!content.trim()) {
            return callback({
              success: false,
              error: "Message cannot be empty",
            });
          }

          const message = await this.chatService.sendMessage(
            conversationId,
            this.socket.data.userId,
            content,
          );

          this.io
            .to(conversationId)
            .emit("message:new", message);

          callback({
            success: true,
            messageId: message.id,
          });
        } catch(e) {
          callback({
            success: false,
            error: "Could not send message",
          });
        }
      },
    );
  }

  private handleTyping() {
    this.socket.on("typing:start", ({ conversationId }) => {
      console.log('typing')
      this.socket.to(conversationId).emit("user:typing", {
        userId: this.socket.data.userId,
        conversationId,
      });
    });

    this.socket.on("typing:stop", ({ conversationId }) => {
      console.log('stoppedTyping')
      
      this.socket.to(conversationId).emit("user:stopped_typing", {
        userId: this.socket.data.userId,
        conversationId,
      });
    });
  }
}
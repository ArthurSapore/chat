import type { Server as HttpServer } from "node:http"
import { Server } from "socket.io"

import { env } from "@/config/env"
import type { Container } from "@/container"
import { ChatGateway } from "@/modules/chat/chat-gateway"
import { createSocketAuthMiddleware } from "@/socket/socket-middleware"
import type { ChatServer } from "@/socket/types"

export function createSocketServer(
  httpServer: HttpServer,
  container: Container
): ChatServer {
  const io: ChatServer = new Server(httpServer, {
    cors: {
      origin: env.UI_URL,
      credentials: true,
    },
  })

  io.use(createSocketAuthMiddleware(container.authService))

  const chatGateway = new ChatGateway(
    io,
    container.conversationService,
    container.messageService
  )

  io.on("connection", (socket) => {
    console.log(`[socket] conectado: ${socket.data.userId} (${socket.id})`)

    chatGateway.register(socket)

    socket.on("disconnect", (reason) => {
      console.log(`[socket] desconectado: ${socket.data.userId} (${reason})`)
    })
  })

  io.engine.on("connection_error", (err) => {
    console.error("[socket] erro de conexão:", err.code, err.message)
  })

  return io
}

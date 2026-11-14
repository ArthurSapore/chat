import { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

import type {
  InterServerEvents,
  SocketData,
} from "@/modules/chat/types";

import { env } from "@/config/env";
import { ChatGateway } from "@/modules/chat/chat-gateway";
import { socketAuthMiddleware } from "@/socket/socket-middleware";
import type { ClientToServerEvents, ServerToClientEvents } from "@workspace/contracts";

export let io: Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function initializeSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.UI_URL,
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware);
  
  io.on("connection", (socket) =>{
    console.log("Socket server is runnnig! ")
    console.log(`User connected: ${socket.data.userId}`);

    const gateway = new ChatGateway(io, socket);

    gateway.registerListeners();

    socket.on("disconnect", (reason) => {
      console.log(`User disconnected: ${reason}`);
    });
  });

  io.engine.on("connection_error", (err) => {
    console.error("Socket connection error:", err.code, err.message, err.context);
  });

  return io;
}
import { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

import type {
    ClientToServerEvents,
    InterServerEvents,
    ServerToClientEvents,
    SocketData,
} from "@/modules/chat/types.js";

import { env } from "@/config/env.js";
import { ChatGateway } from "@/modules/chat/chat-gateway.js";
import { socketAuthMiddleware } from "@/socket/socket-middleware.js";

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

  return io;
}
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@workspace/contracts"
import type { Server, Socket } from "socket.io"

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InterServerEvents {}

export interface SocketData {
  userId: string
}

export type ChatServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

export type ChatSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

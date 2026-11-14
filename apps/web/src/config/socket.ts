import { API_URL } from "@/config/http"
import { io, type Socket } from "socket.io-client"
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../../../packages/contracts/src"

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export const socket: ChatSocket = io(API_URL, {
  autoConnect: false,
  auth: (callback) => {
    callback({
      token: "authTokenExample",
    })
  },
})

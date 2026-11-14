import { API_URL } from "@/config/http"
import { io } from "socket.io-client"

export const socket = io(API_URL, {
  autoConnect: false,
  auth: (callback) => {
    callback({
      token: "authTokenExample",
    })
  },
})

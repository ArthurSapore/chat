import type { AuthService } from "@/modules/auth/auth-service"
import type { ChatSocket } from "@/socket/types"

export function createSocketAuthMiddleware(authService: AuthService) {
  return (socket: ChatSocket, next: (err?: Error) => void) => {
    const token: unknown = socket.handshake.auth.token
    const user = authService.verifyToken(
      typeof token === "string" ? token : null
    )

    if (!user) return next(new Error("Unauthorized"))

    socket.data.userId = user.userId
    next()
  }
}

import { Socket } from "socket.io";
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "../modules/chat/types.js";

type ChatSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function socketAuthMiddleware(
  socket: ChatSocket,
  next: (err?: Error) => void,
) {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Unauthorized"));
  }

  try {
    // const payload = jwt.verify(
    //   token,
    //   process.env.JWT_SECRET!,
    // ) as jwt.JwtPayload;

    if (token !== "authTokenExample") {
      return next(new Error("Invalid token"));
    }

    socket.data.userId = "example_user";

    next();
  } catch {
    next(new Error("Invalid token"));
  }
}
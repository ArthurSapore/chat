import { app } from "@/app";
import { env } from "@/config/env";
import { initializeSocket } from "@/socket/socket-server";
import { createServer } from "node:http";

const port = env.PORT

const httpServer = createServer(app);

try {
  initializeSocket(httpServer);
} catch (error) {
  console.error("Failed to initialize socket server:", error);
  process.exit(1);
}

httpServer.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use`);
  } else {
    console.error("HTTP server error:", error);
  }
  process.exit(1);
});

httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
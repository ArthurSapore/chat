import { app } from "@/app.js";
import { env } from "@/config/env.js";
import { initializeSocket } from "@/socket/socket-server.js";
import { createServer } from "node:http";

const port = env.PORT

const httpServer = createServer(app);

initializeSocket(httpServer);

httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
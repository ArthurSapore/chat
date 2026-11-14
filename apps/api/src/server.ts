import { createServer } from "node:http"

import { createApp } from "@/app"
import { env } from "@/config/env"
import { createContainer } from "@/container"
import { createSocketServer } from "@/socket/socket-server"

const container = createContainer()
const httpServer = createServer(createApp(container))

try {
  createSocketServer(httpServer, container)
} catch (error) {
  console.error("Falha ao iniciar o servidor de socket:", error)
  process.exit(1)
}

httpServer.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`A porta ${env.PORT} já está em uso`)
  } else {
    console.error("Erro no servidor HTTP:", error)
  }
  process.exit(1)
})

httpServer.listen(env.PORT, () => {
  console.log(`Servidor rodando na porta ${env.PORT}`)
})

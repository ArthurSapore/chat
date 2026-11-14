import { SYSTEM_PATHS } from "@workspace/contracts"
import cors from "cors"
import express, { type Express } from "express"

import { env } from "@/config/env"
import type { Container } from "@/container"
import { requireAuth } from "@/http/middlewares/auth"
import { errorHandler, notFoundHandler } from "@/http/middlewares/error-handler"
import { createMessageRoutes } from "@/modules/messages/message-routes"

export function createApp(container: Container): Express {
  const app = express()

  app.use(cors({ origin: env.UI_URL, credentials: true }))
  app.use(express.json())

  // Rotas públicas
  app.get(SYSTEM_PATHS.health, (_req, res) => {
    res.json({ status: "ok" })
  })

  // Rotas autenticadas
  app.use(requireAuth(container.authService))
  app.use(createMessageRoutes(container.messageService))

  // Express 5 já encaminha erros de handlers async para cá.
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

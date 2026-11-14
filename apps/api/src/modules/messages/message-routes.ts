import {
  MESSAGE_PATHS,
  idSchema,
  messagesQuerySchema,
  type MessagePage,
} from "@workspace/contracts"
import { Router, type Response } from "express"

import { authUserId } from "@/http/middlewares/auth"
import type { MessageService } from "@/modules/messages/message-service"

export function createMessageRoutes(messageService: MessageService) {
  const router = Router()

  // GET /conversations/:conversationId/messages?before|after|around=<id>&limit=
  router.get(
    MESSAGE_PATHS.conversationMessages,
    async (req, res: Response<MessagePage>) => {
      // ZodError aqui vira 400 no error handler.
      const conversationId = idSchema.parse(req.params.conversationId)
      const query = messagesQuerySchema.parse(req.query)

      const page = await messageService.list(
        authUserId(res),
        conversationId,
        query
      )
      res.json(page)
    }
  )

  return router
}

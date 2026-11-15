import { idSchema, MESSAGE_PATHS, type MessageInfo } from "@workspace/contracts"
import { Router, type Response } from "express"

import { authUserId } from "@/http/middlewares/auth"
import type { ReceiptService } from "@/modules/receipts/receipt-service"

export function createReceiptRoutes(receiptService: ReceiptService) {
  const router = Router()

  // GET /conversations/:conversationId/messages/:messageId/info
  router.get(
    MESSAGE_PATHS.messageInfo,
    async (req, res: Response<MessageInfo>) => {
      // ZodError aqui vira 400 no error handler.
      const conversationId = idSchema.parse(req.params.conversationId)
      const messageId = idSchema.parse(req.params.messageId)

      const info = await receiptService.getMessageInfo(authUserId(res), {
        conversationId,
        messageId,
      })
      res.json(info)
    }
  )

  return router
}

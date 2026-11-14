import type { MemberReceipt } from "@workspace/contracts"

import type { ConversationMessage, DeliveryStatus } from "@/features/chat/types"

const reached = (marker: string | null, createdAt: string) =>
  marker !== null && marker >= createdAt

/**
 * Cria a função que dá o status de uma mensagem do próprio usuário. Os
 * marcadores dos outros participantes são separados uma vez só, não a cada
 * mensagem.
 *
 * Entregue/lida só quando TODOS os outros participantes chegaram até ela (em
 * conversa de duas pessoas, o outro). Mensagens de outras pessoas não têm
 * status (`null`).
 */
export function createDeliveryStatusResolver(
  currentUserId: string,
  receipts: MemberReceipt[]
) {
  const others = receipts.filter((r) => r.userId !== currentUserId)

  return (message: ConversationMessage): DeliveryStatus | null => {
    if (message.senderId !== currentUserId) return null
    if (message.localStatus) return message.localStatus
    if (others.length === 0) return "sent"

    if (others.every((r) => reached(r.readAt, message.createdAt))) return "read"
    if (others.every((r) => reached(r.deliveredAt, message.createdAt))) {
      return "delivered"
    }
    return "sent"
  }
}

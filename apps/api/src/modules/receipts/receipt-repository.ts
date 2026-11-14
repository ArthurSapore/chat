import type { MemberReceipt } from "@workspace/contracts"

/**
 * Porta de persistência dos marcadores de entrega/leitura. Numa
 * implementação SQL: colunas `delivered_at` / `read_at` em
 * `conversation_members`.
 */
export interface ReceiptRepository {
  listByConversation(conversationId: string): Promise<MemberReceipt[]>
  find(conversationId: string, userId: string): Promise<MemberReceipt | null>
  save(receipt: MemberReceipt): Promise<MemberReceipt>
}

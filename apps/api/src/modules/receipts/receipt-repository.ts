import type { MemberReceipt } from "@workspace/contracts"

/**
 * Um avanço do marcador: o estado do marcador logo depois de mudar e quando
 * isso aconteceu. É o que permite responder "quando a mensagem X chegou/foi
 * lida": o primeiro avanço cujo marcador alcançou o `createdAt` de X.
 */
export interface ReceiptHistoryEntry extends MemberReceipt {
  changedAt: string
}

/**
 * Porta de persistência dos marcadores de entrega/leitura. Numa
 * implementação SQL: colunas `delivered_at` / `read_at` em
 * `conversation_members` e uma tabela `receipt_history` indexada por
 * (conversation_id, user_id, delivered_at/read_at).
 */
export interface ReceiptRepository {
  listByConversation(conversationId: string): Promise<MemberReceipt[]>
  find(conversationId: string, userId: string): Promise<MemberReceipt | null>
  save(receipt: MemberReceipt): Promise<MemberReceipt>

  appendHistory(entry: ReceiptHistoryEntry): Promise<void>
  /** Avanços de um participante, do mais antigo para o mais recente. */
  listHistory(
    conversationId: string,
    userId: string
  ): Promise<ReceiptHistoryEntry[]>
}

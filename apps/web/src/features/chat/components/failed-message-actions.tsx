import type { FailedMessageHandlers } from "@/features/chat/types"

/** "Não enviada · Tentar novamente · Descartar" para mensagens que falharam. */
export function FailedMessageActions({
  clientId,
  onRetry,
  onDiscard,
}: FailedMessageHandlers & { clientId: string }) {
  return (
    <span className="flex items-center gap-1 text-destructive">
      Não enviada ·
      <button
        type="button"
        onClick={() => onRetry(clientId)}
        className="font-medium underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
      >
        Tentar novamente
      </button>
      ·
      <button
        type="button"
        onClick={() => onDiscard(clientId)}
        className="underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
      >
        Descartar
      </button>
    </span>
  )
}

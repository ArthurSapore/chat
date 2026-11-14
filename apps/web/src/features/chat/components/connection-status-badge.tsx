import { cn } from "@workspace/ui/lib/utils"

import type { ConnectionStatus } from "@/features/chat/context/chat-session-context"

const labels: Record<ConnectionStatus, string> = {
  connecting: "Conectando…",
  connected: "Online",
  disconnected: "Offline",
}

/** Mostra o estado da conexão do socket da sessão. */
export function ConnectionStatusBadge({
  status,
}: {
  status: ConnectionStatus
}) {
  return (
    <span
      role="status"
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground",
        status === "disconnected" && "text-destructive"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full bg-muted-foreground",
          status === "connecting" && "animate-pulse",
          status === "connected" && "bg-green-500",
          status === "disconnected" && "bg-destructive"
        )}
      />
      {labels[status]}
    </span>
  )
}

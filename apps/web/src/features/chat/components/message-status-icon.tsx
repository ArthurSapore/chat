import {
  IconAlertCircle,
  IconCheck,
  IconChecks,
  IconClock,
} from "@tabler/icons-react"

import { cn } from "@workspace/ui/lib/utils"

import type { DeliveryStatus } from "@/features/chat/types"

const config: Record<
  DeliveryStatus,
  { icon: typeof IconCheck; label: string; className?: string }
> = {
  sending: { icon: IconClock, label: "Enviando" },
  failed: {
    icon: IconAlertCircle,
    label: "Falha ao enviar",
    className: "text-destructive",
  },
  sent: { icon: IconCheck, label: "Enviada" },
  delivered: { icon: IconChecks, label: "Entregue" },
  read: { icon: IconChecks, label: "Lida", className: "text-sky-500" },
}

/** 🕓 enviando · ✓ enviada · ✓✓ entregue · ✓✓ azul lida · ⚠ falhou. */
export function MessageStatusIcon({ status }: { status: DeliveryStatus }) {
  const { icon: Icon, label, className } = config[status]
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex">
      <Icon className={cn("size-3.5", className)} />
    </span>
  )
}

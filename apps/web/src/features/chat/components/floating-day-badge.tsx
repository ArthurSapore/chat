import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

/**
 * Badge no topo da lista com o dia das mensagens visíveis, mostrado enquanto
 * o usuário rola. Decorativo: a informação também está nos separadores.
 */
export function FloatingDayBadge({
  label,
  visible,
}: {
  label: string | null
  visible: boolean
}) {
  return (
    <Badge
      variant="outline"
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 bg-background/90 shadow-sm backdrop-blur transition-opacity duration-300",
        visible && label ? "opacity-100" : "opacity-0"
      )}
    >
      {label}
    </Badge>
  )
}

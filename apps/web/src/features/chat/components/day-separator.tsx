import { Marker, MarkerContent } from "@workspace/ui/components/marker"

/** Divisão entre mensagens de dias diferentes: ── Hoje ── */
export function DaySeparator({ label }: { label: string }) {
  return (
    <Marker
      variant="separator"
      role="separator"
      aria-label={label}
      className="py-2 text-xs"
    >
      <MarkerContent className="font-medium">{label}</MarkerContent>
    </Marker>
  )
}

import { cn } from "@workspace/ui/lib/utils"

/** Avatar com a inicial do nome. */
export function UserAvatar({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium uppercase",
        className
      )}
    >
      {name.charAt(0)}
    </span>
  )
}

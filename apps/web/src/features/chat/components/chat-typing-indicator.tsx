interface ChatTypingIndicatorProps {
  userIds: string[]
  getUserName: (userId: string) => string
}

/** "Fulano está digitando…". Reserva a altura para o layout não pular. */
export function ChatTypingIndicator({
  userIds,
  getUserName,
}: ChatTypingIndicatorProps) {
  const names = userIds.map(getUserName)

  const text =
    names.length === 0
      ? ""
      : names.length === 1
        ? `${names[0]} está digitando`
        : names.length === 2
          ? `${names[0]} e ${names[1]} estão digitando`
          : "Várias pessoas estão digitando"

  return (
    <p
      aria-live="polite"
      className="flex h-5 items-center gap-1.5 text-xs text-muted-foreground"
    >
      {text && (
        <>
          <span className="inline-flex gap-0.5" aria-hidden>
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="size-1 animate-bounce rounded-full bg-muted-foreground"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
          {text}…
        </>
      )}
    </p>
  )
}

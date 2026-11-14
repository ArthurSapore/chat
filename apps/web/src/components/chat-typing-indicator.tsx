interface ChatTypingIndicatorProps {
  userIds: string[]
  getUserName: (userId: string) => string
}

export function ChatTypingIndicator({
  userIds,
  getUserName,
}: ChatTypingIndicatorProps) {
  if (userIds.length === 0) return null

  const names = userIds.map(getUserName)

  const text =
    names.length === 1
      ? `${names[0]} está digitando...`
      : names.length === 2
        ? `${names[0]} e ${names[1]} estão digitando...`
        : "Várias pessoas estão digitando..."

  return <p className="text-sm text-muted-foreground">{text}</p>
}

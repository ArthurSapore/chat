import type { MessageReaction, ReactionType } from "@workspace/contracts"

import { cn } from "@workspace/ui/lib/utils"

import { summarizeReactions } from "@/features/chat/lib/reactions"

interface MessageReactionsProps {
  reactions: MessageReaction[]
  currentUserId: string
  getUserName: (userId: string) => string
  onToggle: (type: ReactionType) => void
}

/**
 * Reações agrupadas por tipo, com contagem. Clicar numa reação aplica a
 * mesma regra do menu (igual remove, diferente substitui).
 */
export function MessageReactions({
  reactions,
  currentUserId,
  getUserName,
  onToggle,
}: MessageReactionsProps) {
  const summary = summarizeReactions(reactions, currentUserId)
  if (summary.length === 0) return null

  return (
    <div data-slot="message-reactions" className="flex flex-wrap gap-1">
      {summary.map((reaction) => (
        <button
          key={reaction.type}
          type="button"
          onClick={() => onToggle(reaction.type)}
          aria-pressed={reaction.reactedByMe}
          title={`${reaction.label}: ${reaction.userIds.map(getUserName).join(", ")}`}
          className={cn(
            "flex h-6 items-center gap-1 rounded-full border bg-background px-2 text-xs transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50",
            reaction.reactedByMe && "border-primary/40 bg-primary/10"
          )}
        >
          <span className="leading-none">{reaction.emoji}</span>
          <span className="tabular-nums">{reaction.count}</span>
        </button>
      ))}
    </div>
  )
}

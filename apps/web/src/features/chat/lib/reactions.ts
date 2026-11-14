import type { MessageReaction, ReactionType } from "@workspace/contracts"

export interface ReactionOption {
  type: ReactionType
  emoji: string
  label: string
}

/** Ordem e apresentação das reações (os tipos vêm do contrato). */
export const REACTION_OPTIONS: ReactionOption[] = [
  { type: "like", emoji: "👍", label: "Curtir" },
  { type: "love", emoji: "❤️", label: "Amei" },
  { type: "laugh", emoji: "😂", label: "Haha" },
  { type: "wow", emoji: "😮", label: "Uau" },
  { type: "sad", emoji: "😢", label: "Triste" },
  { type: "dislike", emoji: "👎", label: "Não curti" },
]

export interface ReactionSummary extends ReactionOption {
  count: number
  userIds: string[]
  reactedByMe: boolean
}

/** Agrupa as reações por tipo, na ordem de REACTION_OPTIONS. */
export function summarizeReactions(
  reactions: MessageReaction[],
  currentUserId: string
): ReactionSummary[] {
  return REACTION_OPTIONS.flatMap((option) => {
    const userIds = reactions
      .filter((r) => r.type === option.type)
      .map((r) => r.userId)
    if (userIds.length === 0) return []
    return [
      {
        ...option,
        count: userIds.length,
        userIds,
        reactedByMe: userIds.includes(currentUserId),
      },
    ]
  })
}

export function myReaction(
  reactions: MessageReaction[],
  currentUserId: string
): ReactionType | null {
  return reactions.find((r) => r.userId === currentUserId)?.type ?? null
}

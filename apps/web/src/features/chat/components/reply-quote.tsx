import type { ReplyPreview } from "@workspace/contracts"
import { IconCornerUpLeft } from "@tabler/icons-react"

import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"

interface ReplyQuoteProps {
  replyTo: ReplyPreview
  authorName: string
  align: "start" | "end"
  onJump: (messageId: string) => void
}

/** Trecho da mensagem respondida; clicar leva até a original. */
export function ReplyQuote({
  replyTo,
  authorName,
  align,
  onJump,
}: ReplyQuoteProps) {
  return (
    <Bubble variant="outline" align={align}>
      <BubbleContent
        render={<button type="button" onClick={() => onJump(replyTo.id)} />}
        title="Ir para a mensagem original"
        className="flex items-start gap-2 py-1.5 text-xs"
      >
        <IconCornerUpLeft className="mt-0.5 size-3.5 shrink-0 text-primary" />
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">{authorName}</span>
          <span className="line-clamp-2 text-muted-foreground">
            {replyTo.content}
          </span>
        </span>
      </BubbleContent>
    </Bubble>
  )
}

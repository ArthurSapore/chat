import type { ChatMessage } from "@workspace/contracts"
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@workspace/ui/components/message"

import { UserAvatar } from "@/features/chat/components/user-avatar"

interface MessageItemProps {
  message: ChatMessage
  authorName: string
  /** Mensagem enviada pelo usuário da sessão (alinha à direita). */
  isOwn: boolean
  /** Primeira de uma sequência do mesmo autor: mostra nome e avatar. */
  isFirstInGroup: boolean
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })

/** Uma mensagem: só apresentação, sem estado nem efeitos. */
export function MessageItem({
  message,
  authorName,
  isOwn,
  isFirstInGroup,
}: MessageItemProps) {
  const align = isOwn ? "end" : "start"

  return (
    <Message align={align}>
      {!isOwn &&
        (isFirstInGroup ? (
          <UserAvatar name={authorName} className="self-start" />
        ) : (
          <span className="w-8 shrink-0" aria-hidden />
        ))}

      <MessageContent className="gap-1">
        {!isOwn && isFirstInGroup && <MessageHeader>{authorName}</MessageHeader>}

        <Bubble variant={isOwn ? "default" : "muted"} align={align}>
          <BubbleContent className="whitespace-pre-wrap">
            {message.content}
          </BubbleContent>
        </Bubble>

        <MessageFooter className="font-normal">
          <time dateTime={message.createdAt}>
            {formatTime(message.createdAt)}
          </time>
        </MessageFooter>
      </MessageContent>
    </Message>
  )
}

import { memo } from "react"

import { Bubble, BubbleContent } from "@workspace/ui/components/bubble"
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@workspace/ui/components/message"

import { FailedMessageActions } from "@/features/chat/components/failed-message-actions"
import { MessageActions } from "@/features/chat/components/message-actions"
import { MessageReactions } from "@/features/chat/components/message-reactions"
import { MessageStatusIcon } from "@/features/chat/components/message-status-icon"
import { ReplyQuote } from "@/features/chat/components/reply-quote"
import { UserAvatar } from "@/features/chat/components/user-avatar"
import { formatTime } from "@/features/chat/lib/format"
import type {
  ConversationMessage,
  DeliveryStatus,
  FailedMessageHandlers,
  MessageActionHandlers,
} from "@/features/chat/types"

interface MessageItemProps
  extends MessageActionHandlers, FailedMessageHandlers {
  message: ConversationMessage
  /** Só para mensagens do próprio usuário. */
  status: DeliveryStatus | null
  currentUserId: string
  getUserName: (userId: string) => string
  /** Primeira de uma sequência do mesmo autor: mostra nome e avatar. */
  isFirstInGroup: boolean
  onJump: (messageId: string) => void
}

/**
 * Uma mensagem: citação, conteúdo, reações, menu de ações, horário e status.
 *
 * Memoizada: é o item mais repetido da tela. Só renderiza de novo quando a
 * própria mensagem (mesma referência enquanto não muda), o status ou o
 * agrupamento mudam — desde que os handlers recebidos sejam estáveis.
 */
export const MessageItem = memo(function MessageItem({
  message,
  status,
  currentUserId,
  getUserName,
  isFirstInGroup,
  onJump,
  onReply,
  onEdit,
  onToggleReaction,
  onRetry,
  onDiscard,
}: MessageItemProps) {
  const isOwn = message.senderId === currentUserId
  // Ainda não existe no servidor: sem reações nem ações.
  const isConfirmed = !message.localStatus
  const align = isOwn ? "end" : "start"
  const authorName = getUserName(message.senderId)

  return (
    <Message align={align}>
      {!isOwn &&
        (isFirstInGroup ? (
          <UserAvatar name={authorName} className="self-start" />
        ) : (
          <span className="w-8 shrink-0" aria-hidden />
        ))}

      <MessageContent className="gap-1">
        {!isOwn && isFirstInGroup && (
          <MessageHeader>{authorName}</MessageHeader>
        )}

        {message.replyTo && (
          <ReplyQuote
            replyTo={message.replyTo}
            authorName={getUserName(message.replyTo.senderId)}
            align={align}
            onJump={onJump}
          />
        )}

        <Bubble
          variant={isOwn ? "default" : "muted"}
          align={align}
          className={
            message.localStatus === "failed" ? "opacity-60" : undefined
          }
        >
          <BubbleContent className="whitespace-pre-wrap">
            {message.content}
          </BubbleContent>
        </Bubble>

        {isConfirmed && (
          <>
            <MessageReactions
              reactions={message.reactions}
              currentUserId={currentUserId}
              getUserName={getUserName}
              onToggle={(type) => onToggleReaction(message.id, type)}
            />

            <MessageActions
              message={message}
              currentUserId={currentUserId}
              isOwn={isOwn}
              onReply={onReply}
              onEdit={onEdit}
              onToggleReaction={onToggleReaction}
            />
          </>
        )}

        <MessageFooter className="gap-1 font-normal">
          <time dateTime={message.createdAt}>
            {formatTime(message.createdAt)}
          </time>
          {message.editedAt && (
            <span title={`Editada às ${formatTime(message.editedAt)}`}>
              · editada
            </span>
          )}
          {status && <MessageStatusIcon status={status} />}
          {message.localStatus === "failed" && message.clientId && (
            <FailedMessageActions
              clientId={message.clientId}
              onRetry={onRetry}
              onDiscard={onDiscard}
            />
          )}
        </MessageFooter>
      </MessageContent>
    </Message>
  )
})

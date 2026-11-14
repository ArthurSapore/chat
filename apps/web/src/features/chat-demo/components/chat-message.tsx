import * as React from "react"
import {
  IconArrowBackUp,
  IconCheck,
  IconCopy,
  IconCornerUpLeft,
  IconFileTypePdf,
  IconHeart,
  IconSparkles,
  IconThumbDown,
  IconThumbUp,
  IconUser,
} from "@tabler/icons-react"

import {
  Bubble,
  BubbleContent,
  BubbleGroup,
  BubbleReactions,
} from "@workspace/ui/components/bubble"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@workspace/ui/components/message"

import type { ChatMessage, Reaction } from "@/features/chat-demo/lib/fake-chat-api"

type IconType = React.ComponentType<{ className?: string }>

const REACTIONS: { key: Reaction; label: string; icon: IconType }[] = [
  { key: "like", label: "Gostei", icon: IconThumbUp },
  { key: "dislike", label: "Não gostei", icon: IconThumbDown },
  { key: "heart", label: "Amei", icon: IconHeart },
]

const authorName = (role: ChatMessage["role"]) =>
  role === "user" ? "Você" : "Assistente"

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1.5" aria-label="Digitando">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  )
}

type ChatMessageViewProps = {
  message: ChatMessage
  onJump: (id: string) => void
  onReply: (message: ChatMessage) => void
  onToggleReaction: (id: string, reaction: Reaction) => void
}

/** Ações em ícone. Ficam ocultas até o hover (sempre visíveis em touch). */
function MessageActions({
  message,
  onReply,
  onToggleReaction,
}: Omit<ChatMessageViewProps, "onJump">) {
  const [copied, setCopied] = React.useState(false)

  const actions: {
    key: string
    label: string
    icon: IconType
    active?: boolean
    onClick: () => void
  }[] = [
    {
      key: "reply",
      label: "Responder",
      icon: IconArrowBackUp,
      onClick: () => onReply(message),
    },
    {
      key: "copy",
      label: "Copiar",
      icon: copied ? IconCheck : IconCopy,
      onClick: () => {
        void navigator.clipboard?.writeText(message.text)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      },
    },
    ...(message.role === "assistant"
      ? REACTIONS.map((r) => ({
          key: r.key,
          label: r.label,
          icon: r.icon,
          active: message.reactions?.includes(r.key),
          onClick: () => onToggleReaction(message.id, r.key),
        }))
      : []),
  ]

  return (
    <BubbleGroup className="flex-row gap-1 opacity-0 transition-opacity group-hover/message:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
      {actions.map(({ key, label, icon: Icon, active, onClick }) => (
        <Bubble key={key} variant={active ? "tinted" : "outline"}>
          <BubbleContent
            render={<button type="button" onClick={onClick} />}
            aria-label={label}
            aria-pressed={active}
            title={label}
            className="rounded-full p-1.5"
          >
            <Icon className="size-3.5" />
          </BubbleContent>
        </Bubble>
      ))}
    </BubbleGroup>
  )
}

export function ChatMessageView({
  message,
  onJump,
  onReply,
  onToggleReaction,
}: ChatMessageViewProps) {
  const isUser = message.role === "user"
  const align = isUser ? "end" : "start"
  const reactions = message.reactions ?? []

  return (
    <Message align={align}>
      <MessageAvatar className="size-8">
        {isUser ? (
          <IconUser className="size-4" />
        ) : (
          <IconSparkles className="size-4 text-primary" />
        )}
      </MessageAvatar>
      <MessageContent>
        <MessageHeader className="gap-1.5">
          {authorName(message.role)}
          <span className="font-mono opacity-60">#{message.seq}</span>
        </MessageHeader>

        <BubbleGroup>
          {/* Citação: clicar leva até a mensagem original, carregada ou não */}
          {message.replyTo && (
            <Bubble variant="outline" align={align}>
              <BubbleContent
                render={
                  <button
                    type="button"
                    onClick={() => onJump(message.replyTo!.id)}
                  />
                }
                title={`Ir para #${message.replyTo.seq}`}
                className="flex items-start gap-2 py-1.5 text-xs"
              >
                <IconCornerUpLeft className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">
                    {authorName(message.replyTo.role)} · #{message.replyTo.seq}
                  </span>
                  <span className="line-clamp-2 text-muted-foreground">
                    {message.replyTo.text}
                  </span>
                </span>
              </BubbleContent>
            </Bubble>
          )}

          {message.attachment && (
            <Bubble variant="outline" align={align}>
              <BubbleContent className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <IconFileTypePdf className="size-5" />
                </span>
                <span className="flex flex-col">
                  <span className="font-medium">{message.attachment.name}</span>
                  <span className="text-xs text-muted-foreground">
                    PDF · {message.attachment.size}
                  </span>
                </span>
              </BubbleContent>
            </Bubble>
          )}

          <Bubble
            variant={isUser ? "default" : "muted"}
            align={align}
            className={reactions.length > 0 ? "mb-3" : undefined}
          >
            <BubbleContent className="whitespace-pre-wrap">
              {message.text || <TypingDots />}
            </BubbleContent>
            {reactions.length > 0 && (
              <BubbleReactions align={isUser ? "start" : "end"}>
                {reactions.map((key) => {
                  const Icon = REACTIONS.find((r) => r.key === key)!.icon
                  return (
                    <Icon
                      key={key}
                      className={
                        key === "heart"
                          ? "size-3.5 fill-red-500 text-red-500"
                          : "size-3.5 text-primary"
                      }
                    />
                  )
                })}
              </BubbleReactions>
            )}
          </Bubble>

          {!message.streaming && (
            <MessageActions
              message={message}
              onReply={onReply}
              onToggleReaction={onToggleReaction}
            />
          )}
        </BubbleGroup>

        <MessageFooter>
          {message.streaming ? "escrevendo…" : message.time}
        </MessageFooter>
      </MessageContent>
    </Message>
  )
}

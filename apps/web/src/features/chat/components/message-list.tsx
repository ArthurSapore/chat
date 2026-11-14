import type { ChatMessage } from "@workspace/contracts"
import { IconLoader2 } from "@tabler/icons-react"
import type { UIEvent } from "react"

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller"

import { MessageItem } from "@/features/chat/components/message-item"

/** Distância (px) do topo que dispara o carregamento de mensagens anteriores. */
const LOAD_OLDER_EDGE_PX = 200

interface MessageListProps {
  messages: ChatMessage[]
  currentUserId: string
  getUserName: (userId: string) => string
  isLoading: boolean
  hasOlder: boolean
  isLoadingOlder: boolean
  onLoadOlder: () => void
}

/**
 * Rolagem e paginação da lista: segue o fim quando chega mensagem nova,
 * preserva a posição ao inserir anteriores no topo e pede mais ao chegar
 * perto do topo. Não sabe de onde vêm as mensagens.
 */
export function MessageList({
  messages,
  currentUserId,
  getUserName,
  isLoading,
  hasOlder,
  isLoadingOlder,
  onLoadOlder,
}: MessageListProps) {
  function handleScroll(e: UIEvent<HTMLDivElement>) {
    if (
      e.currentTarget.scrollTop < LOAD_OLDER_EDGE_PX &&
      hasOlder &&
      !isLoadingOlder
    ) {
      onLoadOlder()
    }
  }

  return (
    <MessageScrollerProvider autoScroll>
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport onScroll={handleScroll}>
          <MessageScrollerContent className="flex flex-col gap-2 px-4 py-6">
            {isLoadingOlder && (
              <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <IconLoader2 className="size-3.5 animate-spin" />
                Carregando anteriores…
              </p>
            )}

            {messages.map((message, index) => (
              <MessageScrollerItem key={message.id} messageId={message.id}>
                <MessageItem
                  message={message}
                  authorName={getUserName(message.senderId)}
                  isOwn={message.senderId === currentUserId}
                  isFirstInGroup={
                    messages[index - 1]?.senderId !== message.senderId
                  }
                />
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>

        {isLoading && (
          <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <IconLoader2 className="size-4 animate-spin" />
            Carregando conversa…
          </p>
        )}

        {!isLoading && messages.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Diga olá!
          </p>
        )}

        <MessageScrollerButton direction="end" />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

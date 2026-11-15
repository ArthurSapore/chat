import type { MemberReceipt } from "@workspace/contracts"
import { IconLoader2 } from "@tabler/icons-react"
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react"

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
  useMessageScrollerVisibility,
} from "@workspace/ui/components/message-scroller"
import { cn } from "@workspace/ui/lib/utils"

import { DaySeparator } from "@/features/chat/components/day-separator"
import { FloatingDayBadge } from "@/features/chat/components/floating-day-badge"
import { MessageItem } from "@/features/chat/components/message-item"
import { createDeliveryStatusResolver } from "@/features/chat/lib/delivery-status"
import { formatFuzzyDay, isSameCalendarDay } from "@workspace/utils"
import type {
  ConversationMessage,
  FailedMessageHandlers,
  MessageActionHandlers,
} from "@/features/chat/types"

/** Distância (px) do topo que dispara o carregamento de mensagens anteriores. */
const LOAD_OLDER_EDGE_PX = 200
const HIGHLIGHT_MS = 1800
/** Por quanto tempo o badge do dia continua visível depois que a rolagem para. */
const DAY_BADGE_HIDE_MS = 1200

interface MessageListProps
  extends MessageActionHandlers, FailedMessageHandlers {
  messages: ConversationMessage[]
  receipts: MemberReceipt[]
  currentUserId: string
  getUserName: (userId: string) => string
  isLoading: boolean
  hasOlder: boolean
  isLoadingOlder: boolean
  onLoadOlder: () => void
  /** Ids das mensagens que estão na tela agora (para marcar como lidas). */
  onVisibleChange: (messageIds: string[]) => void
}

/**
 * Rolagem e paginação da lista: segue o fim quando chega mensagem nova,
 * preserva a posição ao inserir anteriores no topo, pede mais ao chegar perto
 * do topo, leva até a mensagem citada e informa o que está visível. Separa as
 * mensagens por dia e, enquanto o usuário rola, mostra o dia no topo. Não sabe
 * de onde vêm as mensagens.
 *
 * Memoizada: com props estáveis, não renderiza de novo quando só o resto do
 * painel muda (ex.: "digitando", modo do campo de escrita).
 */
export const MessageList = memo(function MessageList(props: MessageListProps) {
  return (
    <MessageScrollerProvider autoScroll>
      <MessageListContent {...props} />
    </MessageScrollerProvider>
  )
})

function MessageListContent({
  messages,
  receipts,
  currentUserId,
  getUserName,
  isLoading,
  hasOlder,
  isLoadingOlder,
  onLoadOlder,
  onReply,
  onEdit,
  onToggleReaction,
  onRetry,
  onDiscard,
  onVisibleChange,
}: MessageListProps) {
  const { scrollToMessage } = useMessageScroller()
  const { visibleMessageIds } = useMessageScrollerVisibility()
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const scrollIdleTimer = useRef<number | undefined>(undefined)

  // Lido por callbacks estáveis (sem recriá-los a cada mensagem nova).
  const messagesRef = useRef(messages)
  useLayoutEffect(() => {
    messagesRef.current = messages
  })

  useEffect(() => {
    onVisibleChange(visibleMessageIds)
  }, [visibleMessageIds, onVisibleChange])

  useEffect(() => {
    if (!highlightedId) return
    const timer = window.setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS)
    return () => window.clearTimeout(timer)
  }, [highlightedId])

  useEffect(function clearScrollIdleTimer() {
    return function cleanup() {
      window.clearTimeout(scrollIdleTimer.current)
    }
  }, [])

  // Dia da mensagem mais acima na tela (os ids visíveis vêm na ordem do DOM).
  const topVisibleDayLabel = useMemo(
    function findTopVisibleDay() {
      const firstVisibleId = visibleMessageIds[0]
      const message = firstVisibleId
        ? messages.find((m) => m.id === firstVisibleId)
        : undefined
      return message ? formatFuzzyDay(message.createdAt) : null
    },
    [messages, visibleMessageIds]
  )

  const statusOf = useMemo(
    () => createDeliveryStatusResolver(currentUserId, receipts),
    [currentUserId, receipts]
  )

  function handleScroll(e: UIEvent<HTMLDivElement>) {
    // Rolagem automática (seguir o fim, carga inicial) não mostra o badge.
    if (!e.currentTarget.hasAttribute("data-autoscrolling")) {
      setIsUserScrolling(true)
      window.clearTimeout(scrollIdleTimer.current)
      scrollIdleTimer.current = window.setTimeout(
        () => setIsUserScrolling(false),
        DAY_BADGE_HIDE_MS
      )
    }

    if (
      e.currentTarget.scrollTop < LOAD_OLDER_EDGE_PX &&
      hasOlder &&
      !isLoadingOlder
    ) {
      onLoadOlder()
    }
  }

  /**
   * Só rola se a original estiver carregada (a citação já mostra o trecho).
   * Estável: é passada a todos os itens memoizados.
   */
  const jumpTo = useCallback(
    (messageId: string) => {
      if (!messagesRef.current.some((m) => m.id === messageId)) return
      scrollToMessage(messageId, { align: "center", behavior: "smooth" })
      setHighlightedId(messageId)
    },
    [scrollToMessage]
  )

  return (
    <MessageScroller className="min-h-0 flex-1">
      <MessageScrollerViewport onScroll={handleScroll}>
        <MessageScrollerContent className="flex flex-col gap-2 px-4 py-6">
          {isLoadingOlder && (
            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <IconLoader2 className="size-3.5 animate-spin" />
              Carregando anteriores…
            </p>
          )}

          {messages.map((message, index) => {
            const previous = messages[index - 1]
            const startsNewDay =
              !previous ||
              !isSameCalendarDay(previous.createdAt, message.createdAt)

            return (
              <MessageScrollerItem
                // A otimista (id = clientId) e a confirmada (id do servidor)
                // são o mesmo item: a key pelo clientId evita remontar o DOM.
                key={message.clientId ?? message.id}
                messageId={message.id}
                className={cn(
                  "-mx-2 rounded-2xl px-2 py-1 transition-colors duration-700",
                  highlightedId === message.id && "bg-primary/10 duration-150"
                )}
              >
                {startsNewDay && (
                  <DaySeparator label={formatFuzzyDay(message.createdAt)} />
                )}
                <MessageItem
                  message={message}
                  status={statusOf(message)}
                  currentUserId={currentUserId}
                  getUserName={getUserName}
                  isFirstInGroup={
                    startsNewDay || previous?.senderId !== message.senderId
                  }
                  onJump={jumpTo}
                  onReply={onReply}
                  onEdit={onEdit}
                  onToggleReaction={onToggleReaction}
                  onRetry={onRetry}
                  onDiscard={onDiscard}
                />
              </MessageScrollerItem>
            )
          })}
        </MessageScrollerContent>
      </MessageScrollerViewport>

      <FloatingDayBadge label={topVisibleDayLabel} visible={isUserScrolling} />

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
  )
}

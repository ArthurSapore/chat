import type {
  ChatMessage,
  MemberReceipt,
  MessageInfo,
} from "@workspace/contracts"
import {
  IconCheck,
  IconChecks,
  IconInfoCircle,
  IconLoader2,
} from "@tabler/icons-react"
import { useEffect, useState, type ComponentType } from "react"

import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"

import { useChatSessionContext } from "@/features/chat/context/chat-session-context"
import { formatDateTime } from "@workspace/utils"
import { getMessageInfoRequest } from "@/features/chat/service/requests"

type InfoState =
  | { status: "loading" }
  | { status: "ready"; info: MessageInfo }
  | { status: "error"; error: string }

interface MessageInfoPopoverProps {
  message: ChatMessage
  getUserName: (userId: string) => string
  align: "start" | "end"
  onOpenChange?: (open: boolean) => void
  triggerClassName?: string
}

/**
 * Botão "Info" das mensagens do próprio usuário: quando foi enviada e, para
 * cada destinatário, quando chegou e quando foi lida. Enquanto aberto, se
 * atualiza sozinho quando um recibo da conversa muda.
 */
export function MessageInfoPopover({
  message,
  getUserName,
  align,
  onOpenChange,
  triggerClassName,
}: MessageInfoPopoverProps) {
  const { user, socket } = useChatSessionContext()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<InfoState>({ status: "loading" })
  const { id: messageId, conversationId } = message

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) setState({ status: "loading" })
    setOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  useEffect(
    function loadInfoWhileOpen() {
      if (!open) return
      const controller = new AbortController()

      function load() {
        getMessageInfoRequest(
          { conversationId, messageId },
          { token: user.token, signal: controller.signal }
        )
          .then(({ data }) => setState({ status: "ready", info: data }))
          .catch((error: unknown) => {
            if (controller.signal.aborted) return
            setState({
              status: "error",
              error: error instanceof Error ? error.message : "Erro inesperado",
            })
          })
      }

      function onReceiptUpdated(receipt: MemberReceipt) {
        if (receipt.conversationId === conversationId) load()
      }

      load()
      socket.on("receipt:updated", onReceiptUpdated)
      return function stopLoading() {
        controller.abort()
        socket.off("receipt:updated", onReceiptUpdated)
      }
    },
    [open, socket, user.token, conversationId, messageId]
  )

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        aria-label="Informações da mensagem"
        title="Informações"
        className={triggerClassName}
      >
        <IconInfoCircle className="size-3.5" />
      </PopoverTrigger>

      <PopoverContent side="top" align={align} className="w-64 gap-3">
        <PopoverHeader>
          <PopoverTitle>Informações da mensagem</PopoverTitle>
        </PopoverHeader>

        {state.status === "loading" && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <IconLoader2 className="size-3.5 animate-spin" />
            Carregando…
          </p>
        )}

        {state.status === "error" && (
          <p className="text-xs text-destructive">{state.error}</p>
        )}

        {state.status === "ready" && (
          <dl className="flex flex-col gap-2 text-xs">
            <InfoRow
              icon={IconCheck}
              label="Enviada"
              value={formatDateTime(state.info.sentAt)}
            />
            {state.info.recipients.map((recipient) => (
              <div key={recipient.userId} className="flex flex-col gap-2">
                {state.info.recipients.length > 1 && (
                  <p className="pt-1 font-medium">
                    {getUserName(recipient.userId)}
                  </p>
                )}
                <InfoRow
                  icon={IconChecks}
                  label="Entregue"
                  value={
                    recipient.deliveredAt
                      ? formatDateTime(recipient.deliveredAt)
                      : null
                  }
                />
                <InfoRow
                  icon={IconChecks}
                  iconClassName="text-sky-500"
                  label="Lida"
                  value={
                    recipient.readAt ? formatDateTime(recipient.readAt) : null
                  }
                />
              </div>
            ))}
          </dl>
        )}
      </PopoverContent>
    </Popover>
  )
}

function InfoRow({
  icon: Icon,
  iconClassName,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>
  iconClassName?: string
  label: string
  /** null = ainda não aconteceu. */
  value: string | null
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon
        className={cn("size-3.5 shrink-0 text-muted-foreground", iconClassName)}
      />
      <dt className="flex-1">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          value === null && "text-muted-foreground"
        )}
      >
        {value ?? "Aguardando"}
      </dd>
    </div>
  )
}

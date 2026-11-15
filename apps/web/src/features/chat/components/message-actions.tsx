import type { ChatMessage } from "@workspace/contracts"
import {
  IconArrowBackUp,
  IconCheck,
  IconCopy,
  IconPencil,
} from "@tabler/icons-react"
import { useEffect, useState, type ComponentType } from "react"

import { cn } from "@workspace/ui/lib/utils"

import { MessageInfoPopover } from "@/features/chat/components/message-info-popover"
import { ReactionPicker } from "@/features/chat/components/reaction-picker"
import { useEditWindow } from "@/features/chat/hooks/use-edit-window"
import { myReaction } from "@/features/chat/lib/reactions"
import type { MessageActionHandlers } from "@/features/chat/types"

const COPIED_FEEDBACK_MS = 1200

const actionButtonClass =
  "flex size-7 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-expanded:bg-muted aria-expanded:text-foreground"

interface MessageActionsProps extends MessageActionHandlers {
  message: ChatMessage
  currentUserId: string
  isOwn: boolean
  getUserName: (userId: string) => string
}

/**
 * Menu de ações embaixo da mensagem: Responder, Copiar, Reagir e, só para o
 * autor, Info e Editar (nos 15 minutos após o envio e nunca em mensagens
 * encaminhadas). Fica oculto até o hover/foco; em telas touch fica sempre
 * visível.
 */
export function MessageActions({
  message,
  currentUserId,
  isOwn,
  getUserName,
  onReply,
  onEdit,
  onToggleReaction,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const canEdit = useEditWindow(
    message.createdAt,
    isOwn && message.forwardedFrom === null
  )

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
    } catch {
      // Sem permissão de clipboard: não há o que fazer além de não confirmar.
    }
  }

  return (
    <div
      data-slot="message-actions"
      className={cn(
        "flex items-center gap-1 opacity-0 transition-opacity group-hover/message:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100",
        (isPickerOpen || isInfoOpen) && "opacity-100"
      )}
    >
      <ActionButton
        label="Responder"
        icon={IconArrowBackUp}
        onClick={() => onReply(message)}
      />
      <ActionButton
        label={copied ? "Copiado" : "Copiar"}
        icon={copied ? IconCheck : IconCopy}
        onClick={() => void copy()}
      />
      <ReactionPicker
        selected={myReaction(message.reactions, currentUserId)}
        onSelect={(type) => onToggleReaction(message.id, type)}
        onOpenChange={setIsPickerOpen}
        align={isOwn ? "end" : "start"}
        triggerClassName={actionButtonClass}
      />
      {isOwn && (
        <MessageInfoPopover
          message={message}
          getUserName={getUserName}
          align="end"
          onOpenChange={setIsInfoOpen}
          triggerClassName={actionButtonClass}
        />
      )}
      {canEdit && (
        <ActionButton
          label="Editar (até 15 min após o envio)"
          icon={IconPencil}
          onClick={() => onEdit(message)}
        />
      )}
    </div>
  )
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string
  icon: ComponentType<{ className?: string }>
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={actionButtonClass}
    >
      <Icon className="size-3.5" />
    </button>
  )
}

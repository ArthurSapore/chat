import { IconCornerUpLeft, IconPencil, IconX } from "@tabler/icons-react"

import { Button } from "@workspace/ui/components/button"

import type { ComposerMode } from "@/features/chat/types"

interface ComposerContextBarProps {
  mode: NonNullable<ComposerMode>
  getUserName: (userId: string) => string
  onCancel: () => void
}

/** Faixa acima do campo: "Respondendo a…" ou "Editando mensagem", com cancelar. */
export function ComposerContextBar({
  mode,
  getUserName,
  onCancel,
}: ComposerContextBarProps) {
  const isEdit = mode.kind === "edit"
  const Icon = isEdit ? IconPencil : IconCornerUpLeft

  return (
    <div className="flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {isEdit
            ? "Editando mensagem"
            : `Respondendo a ${getUserName(mode.message.senderId)}`}
        </p>
        <p className="line-clamp-1 text-muted-foreground">
          {mode.message.content}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={isEdit ? "Cancelar edição" : "Cancelar resposta"}
        onClick={onCancel}
      >
        <IconX />
      </Button>
    </div>
  )
}

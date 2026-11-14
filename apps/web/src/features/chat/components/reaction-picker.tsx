import type { ReactionType } from "@workspace/contracts"
import { IconCheck, IconMoodSmile } from "@tabler/icons-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"

import { REACTION_OPTIONS } from "@/features/chat/lib/reactions"

interface ReactionPickerProps {
  /** Reação atual do usuário nesta mensagem. */
  selected: ReactionType | null
  onSelect: (type: ReactionType) => void
  onOpenChange?: (open: boolean) => void
  align: "start" | "end"
  triggerClassName?: string
}

/**
 * Botão único "Reagir" que abre a lista de reações. Escolher outra reação
 * substitui a atual; escolher a mesma remove (a regra fica no servidor).
 */
export function ReactionPicker({
  selected,
  onSelect,
  onOpenChange,
  align,
  triggerClassName,
}: ReactionPickerProps) {
  const current = REACTION_OPTIONS.find((r) => r.type === selected)

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        aria-label={current ? `Reação: ${current.label}` : "Reagir"}
        title="Reagir"
        className={triggerClassName}
      >
        {current ? (
          <span className="text-sm leading-none">{current.emoji}</span>
        ) : (
          <IconMoodSmile className="size-3.5" />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align={align} className="min-w-40">
        {REACTION_OPTIONS.map((option) => {
          const isSelected = option.type === selected
          return (
            <DropdownMenuItem
              key={option.type}
              onClick={() => onSelect(option.type)}
              className={cn(isSelected && "font-medium")}
            >
              <span className="text-base leading-none">{option.emoji}</span>
              <span className="flex-1">{option.label}</span>
              {isSelected && (
                <IconCheck
                  className="size-4 text-primary"
                  aria-label="Selecionada (clique para remover)"
                />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

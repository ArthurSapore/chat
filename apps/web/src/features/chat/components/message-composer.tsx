import { IconArrowUp, IconCheck } from "@tabler/icons-react"
import { useEffect, useRef, useState, type FormEvent } from "react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { ComposerContextBar } from "@/features/chat/components/composer-context-bar"
import type { ComposerMode } from "@/features/chat/types"

interface MessageComposerProps {
  /** Falso enquanto não entrou na sala (sem conexão). */
  canSend: boolean
  mode: ComposerMode
  getUserName: (userId: string) => string
  onCancelMode: () => void
  /** Envia uma nova mensagem/resposta ou salva a edição, conforme o modo. */
  onSubmit: (content: string) => Promise<unknown>
  onTyping: () => void
  onStopTyping: () => void
}

/**
 * Campo de escrita: guarda o rascunho, avisa quando o usuário digita/para e
 * envia. Em modo de edição, começa com o texto original. Só limpa o campo
 * depois que o servidor confirma.
 */
export function MessageComposer({
  canSend,
  mode,
  getUserName,
  onCancelMode,
  onSubmit,
  onTyping,
  onStopTyping,
}: MessageComposerProps) {
  const [draft, setDraft] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isEditing = mode?.kind === "edit"
  const editingId = isEditing ? mode.message.id : null

  // Ao entrar/sair do modo de edição, troca o rascunho (ajuste de estado
  // durante o render, sem efeito: https://react.dev/learn/you-might-not-need-an-effect)
  const [prevEditingId, setPrevEditingId] = useState(editingId)
  if (editingId !== prevEditingId) {
    setPrevEditingId(editingId)
    setDraft(isEditing ? mode.message.content : "")
    setError(null)
  }

  // Responder/editar leva o foco para o campo.
  useEffect(() => {
    if (mode) inputRef.current?.focus()
  }, [mode])

  const isSubmittable = canSend && !isSending && draft.trim().length > 0

  function handleChange(value: string) {
    setDraft(value)
    setError(null)
    // Editar não é "digitando" uma mensagem nova.
    if (isEditing) return
    if (value.trim().length > 0) onTyping()
    else onStopTyping()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isSubmittable) return

    setIsSending(true)
    try {
      await onSubmit(draft)
      setDraft("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      {mode && (
        <ComposerContextBar
          mode={mode}
          getUserName={getUserName}
          onCancel={onCancelMode}
        />
      )}

      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={onStopTyping}
          onKeyDown={(e) => {
            if (e.key === "Escape" && mode) onCancelMode()
          }}
          placeholder={
            !canSend
              ? "Aguardando conexão…"
              : isEditing
                ? "Edite a mensagem…"
                : "Escreva uma mensagem…"
          }
          aria-label={isEditing ? "Editar mensagem" : "Mensagem"}
          autoComplete="off"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!isSubmittable}
          aria-label={isEditing ? "Salvar edição" : "Enviar"}
        >
          {isEditing ? <IconCheck /> : <IconArrowUp />}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  )
}

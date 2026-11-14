import { IconArrowUp } from "@tabler/icons-react"
import { useState, type FormEvent } from "react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

interface MessageComposerProps {
  /** Falso enquanto não entrou na sala (sem conexão). */
  canSend: boolean
  onSend: (content: string) => Promise<unknown>
  onTyping: () => void
  onStopTyping: () => void
}

/**
 * Campo de escrita: guarda o rascunho, avisa quando o usuário digita/para e
 * envia. Só limpa o campo depois que o servidor confirma o envio.
 */
export function MessageComposer({
  canSend,
  onSend,
  onTyping,
  onStopTyping,
}: MessageComposerProps) {
  const [draft, setDraft] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSubmittable = canSend && !isSending && draft.trim().length > 0

  function handleChange(value: string) {
    setDraft(value)
    setError(null)
    if (value.trim().length > 0) onTyping()
    else onStopTyping()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isSubmittable) return

    setIsSending(true)
    try {
      await onSend(draft)
      setDraft("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={onStopTyping}
          placeholder={canSend ? "Escreva uma mensagem…" : "Aguardando conexão…"}
          aria-label="Mensagem"
          autoComplete="off"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!isSubmittable}
          aria-label="Enviar"
        >
          <IconArrowUp />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  )
}

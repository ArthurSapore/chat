import { MESSAGE_EDIT_WINDOW_MS } from "@workspace/contracts"
import { useEffect, useState } from "react"

const deadlineOf = (createdAt: string) =>
  new Date(createdAt).getTime() + MESSAGE_EDIT_WINDOW_MS

/**
 * Se a mensagem ainda pode ser editada. Agenda um único timer para o fim do
 * prazo, então o botão some sozinho sem precisar de re-render externo.
 * (O servidor valida a mesma regra; isto é só para a interface.)
 */
export function useEditWindow(createdAt: string, enabled: boolean) {
  const [isOpen, setIsOpen] = useState(
    () => enabled && Date.now() < deadlineOf(createdAt)
  )

  useEffect(() => {
    if (!enabled) return
    const remaining = deadlineOf(createdAt) - Date.now()
    if (remaining <= 0) return

    const timer = window.setTimeout(() => setIsOpen(false), remaining)
    return () => window.clearTimeout(timer)
  }, [createdAt, enabled])

  return enabled && isOpen
}

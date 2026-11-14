import type { ChatSocket } from "@/lib/socket"
import { useCallback, useEffect, useRef } from "react"

const STOP_DELAY = 1500
const HEARTBEAT_INTERVAL = 5000

export function useTypingIndicator(socket: ChatSocket, conversationId: string) {
  const isTypingRef = useRef(false)
  const lastEmitRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  const stop = useCallback(() => {
    clearTimeout(timeoutRef.current)

    if (!isTypingRef.current) {
      return
    }

    isTypingRef.current = false

    socket.emit("typing:stop", { conversationId })
  }, [socket, conversationId])

  const notifyTyping = useCallback(() => {
    const now = Date.now()

    // emite na transição "parado -> digitando" e, depois, no máximo a cada HEARTBEAT_INTERVAL
    if (
      !isTypingRef.current ||
      now - lastEmitRef.current > HEARTBEAT_INTERVAL
    ) {
      isTypingRef.current = true
      lastEmitRef.current = now
      socket.emit("typing:start", { conversationId })
    }

    // reinicia o contador a cada tecla
    clearTimeout(timeoutRef.current)

    timeoutRef.current = setTimeout(stop, STOP_DELAY)
  }, [socket, conversationId, stop])

  // ao desmontar ou trocar de conversa, encerra o "digitando"
  useEffect(() => stop, [stop])

  return { notifyTyping, stopTyping: stop }
}

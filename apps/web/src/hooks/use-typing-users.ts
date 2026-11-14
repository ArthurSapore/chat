import type { ChatSocket } from "@/config/socket"
import { useEffect, useState } from "react"

type TypingPayload = { userId: string; conversationId: string }

const TYPING_TIMEOUT = 5000

export function useTypingUsers(socket: ChatSocket, conversationId: string) {
  const [typingUserIds, setTypingUserIds] = useState<string[]>([])

  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>()

    const remove = (userId: string) => {
      clearTimeout(timers.get(userId))

      timers.delete(userId)

      setTypingUserIds((prev) => prev.filter((id) => id !== userId))
    }

    const onTyping = (payload: TypingPayload) => {
      console.log("typing")

      if (payload.conversationId !== conversationId) return

      setTypingUserIds((prev) =>
        prev.includes(payload.userId) ? prev : [...prev, payload.userId]
      )

      clearTimeout(timers.get(payload.userId))

      timers.set(
        payload.userId,
        setTimeout(() => remove(payload.userId), TYPING_TIMEOUT)
      )
    }

    const onStopped = (payload: TypingPayload) => {
      console.log("stopped")

      if (payload.conversationId !== conversationId) {
        return
      }

      remove(payload.userId)
    }

    socket.on("user:typing", onTyping)
    socket.on("user:stopped_typing", onStopped)

    return () => {
      socket.off("user:typing", onTyping)
      socket.off("user:stopped_typing", onStopped)
      timers.forEach(clearTimeout)
      setTypingUserIds([])
    }
  }, [socket, conversationId])

  return typingUserIds
}

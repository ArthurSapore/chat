import { ChatTypingIndicator } from "@/components/chat-typing-indicator"
import { useTypingIndicator } from "@/hooks/use-typing-indicator"
import { useTypingUsers } from "@/hooks/use-typing-users"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useEffect, useState } from "react"
import { socket } from "./config/socket"

const conversationId = "conversation-123"

export function App() {
  const [message, setMessage] = useState("")
  const { notifyTyping, stopTyping } = useTypingIndicator(
    socket,
    conversationId
  )
  const typingUserIds = useTypingUsers(socket, conversationId)

  useEffect(() => {
    socket.connect()
    socket.emit(
      "conversation:join",
      { conversationId },
      (response: unknown) => {
        console.log(response)
      }
    )
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setMessage(e.target.value)

    if (e.target.value.length > 0) {
      notifyTyping()
      return
    }

    stopTyping()
  }

  function handleSendMessage() {
    stopTyping()
    socket.emit(
      "message:send",
      { conversationId, content: message },
      (response: { success: boolean; messageId?: string; error?: string }) => {
        if (!response.success) {
          console.error(response.error)
          return
        }
        setMessage("")
      }
    )
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center">
      <div>
        <Input
          type="text"
          value={message}
          onChange={handleChange}
          onBlur={stopTyping}
        />

        <ChatTypingIndicator
          userIds={typingUserIds}
          getUserName={() => "Alguém"}
        />
        <Button onClick={handleSendMessage}> Send message</Button>
      </div>
      <Button variant={"ghost"}> send message</Button>

      {/* <ChatDemo /> */}
      {/* <ChatDemo /> */}
    </div>
  )
}

import { ChatDemo } from "@/components/chat-demo"
import { socket } from "./services/socket"

export function App() {
  socket.connect()
  socket.emit(
    "conversation:join",
    { conversationId: "conversation-123" },
    (response: unknown) => {
      console.log(response)
    }
  )

  return (
    <div className="flex">
      <ChatDemo />
      <ChatDemo />
    </div>
  )
}

import { DEV_USERS } from "@/config/dev-users"
import { ChatPanel } from "@/features/chat/components/chat-panel"
import { ChatSessionContextProvider } from "@/features/chat/context/chat-session-context"

// Enquanto não há lista de conversas, usa a conversa de demonstração da API.
const DEMO_CONVERSATION_ID = "conversation-123"

/**
 * Um chat por usuário de desenvolvimento, lado a lado: cada um com a própria
 * sessão (token + socket), conversando entre si em tempo real.
 */
export function App() {
  return (
    <main className="grid h-svh grid-rows-2 divide-y md:grid-cols-2 md:grid-rows-1 md:divide-x md:divide-y-0">
      {DEV_USERS.map((user) => (
        <ChatSessionContextProvider key={user.id} user={user}>
          <ChatPanel conversationId={DEMO_CONVERSATION_ID} />
        </ChatSessionContextProvider>
      ))}
    </main>
  )
}

import { getUserName } from "@/config/dev-users"
import { ChatHeader } from "@/features/chat/components/chat-header"
import { ChatTypingIndicator } from "@/features/chat/components/chat-typing-indicator"
import { MessageComposer } from "@/features/chat/components/message-composer"
import { MessageList } from "@/features/chat/components/message-list"
import { useConversation } from "@/features/chat/hooks/use-conversation"

/**
 * Composição de um chat: liga o estado da conversa (useConversation) aos
 * componentes de apresentação. Não tem lógica própria.
 * Precisa estar dentro de um <ChatSessionProvider>.
 */
export function ChatPanel({ conversationId }: { conversationId: string }) {
  const conversation = useConversation(conversationId)

  return (
    <section
      aria-label={`Chat de ${conversation.currentUser.name}`}
      className="flex h-full min-h-0 flex-col"
    >
      <ChatHeader
        userName={conversation.currentUser.name}
        conversationTitle={conversationId}
        connection={conversation.connection}
      />

      <MessageList
        messages={conversation.messages}
        currentUserId={conversation.currentUser.id}
        getUserName={getUserName}
        isLoading={conversation.status === "loading"}
        hasOlder={conversation.hasOlder}
        isLoadingOlder={conversation.isLoadingOlder}
        onLoadOlder={() => void conversation.loadOlder()}
      />

      <footer className="flex flex-col gap-1 border-t px-4 pt-1 pb-4">
        <ChatTypingIndicator
          userIds={conversation.typingUserIds}
          getUserName={getUserName}
        />
        {conversation.error && (
          <p className="text-xs text-destructive">{conversation.error}</p>
        )}
        <MessageComposer
          canSend={conversation.isJoined}
          onSend={conversation.sendMessage}
          onTyping={conversation.notifyTyping}
          onStopTyping={conversation.stopTyping}
        />
      </footer>
    </section>
  )
}

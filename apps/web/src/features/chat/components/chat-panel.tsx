import type { ChatMessage, ReactionType } from "@workspace/contracts"
import { useCallback, useState } from "react"

import { getUserName } from "@/config/dev-users"
import { ChatHeader } from "@/features/chat/components/chat-header"
import { ChatTypingIndicator } from "@/features/chat/components/chat-typing-indicator"
import { MessageComposer } from "@/features/chat/components/message-composer"
import { MessageList } from "@/features/chat/components/message-list"
import { useConversation } from "@/features/chat/hooks/use-conversation"
import type { ComposerMode } from "@/features/chat/types"

/**
 * Composição de um chat: liga o estado da conversa (useConversation) aos
 * componentes de apresentação e coordena o modo do campo de escrita
 * (responder/editar), que é disparado pela lista e consumido pelo campo.
 * Precisa estar dentro de um <ChatSessionContextProvider>.
 */
export function ChatPanel({ conversationId }: { conversationId: string }) {
  const conversation = useConversation(conversationId)
  const { loadOlder, toggleReaction } = conversation
  const [composerMode, setComposerMode] = useState<ComposerMode>(null)

  // Handlers estáveis: a lista e os itens são memoizados, e uma função nova
  // a cada render faria todos renderizarem de novo.
  const handleLoadOlder = useCallback(() => void loadOlder(), [loadOlder])
  const handleReply = useCallback(
    (message: ChatMessage) => setComposerMode({ kind: "reply", message }),
    []
  )
  const handleEdit = useCallback(
    (message: ChatMessage) => setComposerMode({ kind: "edit", message }),
    []
  )
  const handleToggleReaction = useCallback(
    (messageId: string, type: ReactionType) =>
      void toggleReaction(messageId, type),
    [toggleReaction]
  )

  async function handleSubmit(content: string) {
    if (composerMode?.kind === "edit") {
      await conversation.editMessage(composerMode.message.id, content)
    } else {
      await conversation.sendMessage(content, {
        replyToId: composerMode?.message.id,
      })
    }
    setComposerMode(null)
  }

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
        receipts={conversation.receipts}
        currentUserId={conversation.currentUser.id}
        getUserName={getUserName}
        isLoading={conversation.status === "loading"}
        hasOlder={conversation.hasOlder}
        isLoadingOlder={conversation.isLoadingOlder}
        onLoadOlder={handleLoadOlder}
        onReply={handleReply}
        onEdit={handleEdit}
        onToggleReaction={handleToggleReaction}
        onRetry={conversation.retryMessage}
        onDiscard={conversation.discardMessage}
        onVisibleChange={conversation.markVisible}
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
          mode={composerMode}
          getUserName={getUserName}
          onCancelMode={() => setComposerMode(null)}
          onSubmit={handleSubmit}
          onTyping={conversation.notifyTyping}
          onStopTyping={conversation.stopTyping}
        />
      </footer>
    </section>
  )
}

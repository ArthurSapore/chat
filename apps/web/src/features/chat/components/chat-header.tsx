import { ConnectionStatusBadge } from "@/features/chat/components/connection-status-badge"
import { UserAvatar } from "@/features/chat/components/user-avatar"
import type { ConnectionStatus } from "@/features/chat/context/chat-session-context"

interface ChatHeaderProps {
  /** Usuário dono desta sessão. */
  userName: string
  conversationTitle: string
  connection: ConnectionStatus
}

/** Identifica de quem é o chat, qual conversa e o estado da conexão. */
export function ChatHeader({
  userName,
  conversationTitle,
  connection,
}: ChatHeaderProps) {
  return (
    <header className="flex items-center gap-3 border-b px-4 py-3">
      <UserAvatar
        name={userName}
        className="bg-primary text-primary-foreground"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{userName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {conversationTitle}
        </p>
      </div>
      <ConnectionStatusBadge status={connection} />
    </header>
  )
}

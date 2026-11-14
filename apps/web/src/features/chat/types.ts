import type { ChatMessage, ReactionType } from "@workspace/contracts"

/** Estado de uma mensagem que ainda não foi confirmada pelo servidor. */
export type LocalStatus = "sending" | "failed"

/**
 * Mensagem como o front a guarda: a do servidor, ou uma otimista (com
 * `localStatus`, id = clientId) que ainda não foi confirmada.
 */
export interface ConversationMessage extends ChatMessage {
  localStatus?: LocalStatus
}

/** Status exibido nas mensagens enviadas pelo próprio usuário. */
export type DeliveryStatus = LocalStatus | "sent" | "delivered" | "read"

/** O que o campo de escrita está fazendo além de enviar uma mensagem nova. */
export type ComposerMode =
  | { kind: "reply"; message: ChatMessage }
  | { kind: "edit"; message: ChatMessage }
  | null

/** Ações que o usuário pode disparar a partir de uma mensagem. */
export interface MessageActionHandlers {
  onReply: (message: ChatMessage) => void
  onEdit: (message: ChatMessage) => void
  onToggleReaction: (messageId: string, type: ReactionType) => void
}

/** Ações sobre uma mensagem que falhou ao enviar. */
export interface FailedMessageHandlers {
  onRetry: (clientId: string) => void
  onDiscard: (clientId: string) => void
}

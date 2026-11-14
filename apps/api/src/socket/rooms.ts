const CONVERSATION_PREFIX = "conversation:"

/**
 * Prefixo evita colisão com as salas automáticas do Socket.IO (cada socket
 * entra numa sala com o próprio id).
 */
export function conversationRoom(conversationId: string) {
  return `${CONVERSATION_PREFIX}${conversationId}`
}

export function conversationIdFromRoom(room: string) {
  return room.startsWith(CONVERSATION_PREFIX)
    ? room.slice(CONVERSATION_PREFIX.length)
    : null
}

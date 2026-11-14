export interface ClientToServerEvents {
  "conversation:join": (
    data: { conversationId: string },
    callback: (response: { success: boolean; error?: string }) => void,
  ) => void;

  "message:send": (
    data: {
      conversationId: string;
      content: string;
    },
    callback: (response: {
      success: boolean;
      messageId?: string;
      error?: string;
    }) => void,
  ) => void;

  "typing:start": (data: { conversationId: string }) => void;
  "typing:stop": (data: { conversationId: string }) => void;
}

export interface ServerToClientEvents {
  "message:new": (message: ChatMessage) => void;

  "user:typing": (data: {
    userId: string;
    conversationId: string;
  }) => void;

  "user:stopped_typing": (data: {
    userId: string;
    conversationId: string;
  }) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  userId: string;
}

export type ChatMessage = {  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;}
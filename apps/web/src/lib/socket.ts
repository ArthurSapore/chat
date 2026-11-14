import type {
  Ack,
  ClientToServerEvents,
  ServerToClientEvents,
} from "@workspace/contracts"
import { io, type Socket } from "socket.io-client"

import { env } from "@/config/env"
import { ApiRequestError } from "@/lib/http"

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>

const ACK_TIMEOUT_MS = 10_000

/** Cada sessão (usuário) tem o próprio socket, autenticado com o seu token. */
export function createChatSocket(token: string): ChatSocket {
  return io(env.API_URL, {
    autoConnect: false,
    // Sem isso, dois sockets no mesmo navegador compartilhariam a conexão
    // (o Socket.IO reaproveita o Manager por URL).
    forceNew: true,
    auth: { token },
  })
}

/** Eventos do cliente cujo último argumento é um ack `Ack<T>`. */
type AckEvents = {
  [E in keyof ClientToServerEvents]: Parameters<
    ClientToServerEvents[E]
  > extends [unknown, (response: Ack<never>) => void]
    ? E
    : never
}[keyof ClientToServerEvents]

type AckData<E extends AckEvents> = Parameters<
  ClientToServerEvents[E]
>[1] extends (response: Ack<infer T>) => void
  ? T
  : never

/**
 * Emite um evento com ack e devolve uma Promise: resolve com `data` ou
 * rejeita com `ApiRequestError` (inclusive em timeout).
 */
export async function emitWithAck<E extends AckEvents>(
  socket: ChatSocket,
  event: E,
  data: Parameters<ClientToServerEvents[E]>[0]
): Promise<AckData<E>> {
  let response: Ack<AckData<E>>
  try {
    // Os tipos genéricos do Socket.IO não acompanham `E` aqui; o contrato
    // de entrada/saída está garantido pela assinatura desta função.
    const timed = socket.timeout(ACK_TIMEOUT_MS)
    const emit = timed.emitWithAck.bind(timed) as unknown as (
      event: E,
      data: unknown
    ) => Promise<Ack<AckData<E>>>
    response = await emit(event, data)
  } catch {
    throw new ApiRequestError({
      code: "INTERNAL_ERROR",
      message: "O servidor não respondeu a tempo",
    })
  }

  if (!response.ok) throw new ApiRequestError(response.error)
  return response.data
}

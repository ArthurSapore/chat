import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@workspace/contracts"
import axios from "axios"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { io as ioClient, type Socket } from "socket.io-client"

import { createApp } from "@/app"
import { createContainer } from "@/container"
import { createSocketServer } from "@/socket/socket-server"

export type TestClient = Socket<ServerToClientEvents, ClientToServerEvents>

export const TOKENS = {
  ana: "authTokenExample", // example_user
  bruno: "authTokenExample2", // other_user
} as const

/**
 * Starts the whole API (HTTP + Socket.IO) on a free port with a fresh
 * container: each test starts from the seed data, isolated from the others.
 */
export async function startTestServer() {
  const container = createContainer()
  const httpServer = createServer(createApp(container))
  const io = createSocketServer(httpServer, container)

  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  const { port } = httpServer.address() as AddressInfo
  const url = `http://127.0.0.1:${port}`
  const clients: TestClient[] = []
  // validateStatus: 4xx/5xx are responses under test, not exceptions.
  const http = axios.create({ baseURL: url, validateStatus: () => true })

  /** Connects an authenticated client; rejects if the server refuses it. */
  function connect(token: string): Promise<TestClient> {
    const client: TestClient = ioClient(url, {
      auth: { token },
      forceNew: true,
      reconnection: false,
      transports: ["websocket"],
    })
    clients.push(client)

    return new Promise((resolve, reject) => {
      client.once("connect", () => resolve(client))
      client.once("connect_error", reject)
    })
  }

  function request<T = unknown>(path: string, token?: string) {
    return http.get<T>(path, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  }

  async function close() {
    for (const client of clients) client.disconnect()
    await io.close() // also closes the HTTP server
  }

  return { url, container, connect, request, close }
}

export type TestServer = Awaited<ReturnType<typeof startTestServer>>

/** Waits for a server event (fails if it does not arrive in time). */
export function nextEvent<E extends keyof ServerToClientEvents>(
  client: TestClient,
  event: E,
  timeoutMs = 1000
): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off(event, listener as never)
      reject(new Error(`Event "${event}" did not arrive within ${timeoutMs}ms`))
    }, timeoutMs)

    function listener(payload: Parameters<ServerToClientEvents[E]>[0]) {
      clearTimeout(timer)
      resolve(payload)
    }

    client.once(event, listener as never)
  })
}

/** Asserts that an event did NOT arrive within the window. */
export async function expectNoEvent<E extends keyof ServerToClientEvents>(
  client: TestClient,
  event: E,
  windowMs = 150
) {
  const received: unknown[] = []
  const listener = (payload: unknown) => received.push(payload)
  client.on(event, listener as never)
  await new Promise((resolve) => setTimeout(resolve, windowMs))
  client.off(event, listener as never)
  if (received.length > 0) {
    throw new Error(`Event "${event}" should not have arrived`)
  }
}

import { describe, expect, it } from "vitest"

import { conversationIdFromRoom, conversationRoom } from "@/socket/rooms"

describe("conversation rooms", () => {
  it("builds and parses the conversation room name", () => {
    const room = conversationRoom("conv-1")

    expect(room).toBe("conversation:conv-1")
    expect(conversationIdFromRoom(room)).toBe("conv-1")
  })

  it("ignores rooms that are not conversations (e.g. the socket's own room)", () => {
    expect(conversationIdFromRoom("Xy7_socketId")).toBeNull()
  })
})

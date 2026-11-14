import { describe, expect, it } from "vitest"

import { AuthService } from "@/modules/auth/auth-service"

describe("AuthService", () => {
  const sut = new AuthService()

  it("resolves the user of a known token", () => {
    expect(sut.verifyToken("authTokenExample")).toEqual({
      userId: "example_user",
    })
    expect(sut.verifyToken("authTokenExample2")).toEqual({
      userId: "other_user",
    })
  })

  it.each([undefined, null, "", "unknown-token"])(
    "returns null for token %j",
    (token) => {
      expect(sut.verifyToken(token)).toBeNull()
    }
  )
})

export interface AuthUser {
  userId: string
}

/**
 * Único ponto que sabe transformar um token em usuário. Usado pelo
 * middleware HTTP e pelo middleware do socket.
 *
 * TODO: trocar pelos tokens fixos por `jwt.verify(token, env.JWT_SECRET)`.
 */
const DEV_TOKENS: Record<string, string> = {
  authTokenExample: "example_user",
  authTokenExample2: "other_user",
}

export class AuthService {
  verifyToken(token: string | undefined | null): AuthUser | null {
    if (!token) return null

    const userId = DEV_TOKENS[token]
    return userId ? { userId } : null
  }
}

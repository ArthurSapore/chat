export interface SessionUser {
  id: string
  name: string
  /** Token de acesso usado no HTTP e no socket. */
  token: string
}

/**
 * Usuários de desenvolvimento enquanto não há login. Os ids e tokens batem
 * com o `AuthService` e o seed da API.
 */
export const DEV_USERS: SessionUser[] = [
  { id: "example_user", name: "Ana", token: "authTokenExample" },
  { id: "other_user", name: "Bruno", token: "authTokenExample2" },
]

const namesById = new Map(DEV_USERS.map((u) => [u.id, u.name]))

/** Nome de exibição; sem diretório de usuários ainda, cai no próprio id. */
export function getUserName(userId: string) {
  return namesById.get(userId) ?? userId
}

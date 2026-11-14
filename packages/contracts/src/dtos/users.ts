import type { ISODateString } from "./common"

/** GET /me — o usuário logado. */
export interface User {
  id: string
  name: string
  email: string
  createdAt: ISODateString
  updatedAt: ISODateString
}

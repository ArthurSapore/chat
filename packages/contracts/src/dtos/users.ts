import type { ISODateString } from "./common"

export interface User {
  id: string
  name: string
  email: string
  createdAt: ISODateString
  updatedAt: ISODateString
}

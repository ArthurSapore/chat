import type { ISODateString } from "@workspace/contracts/dtos/common"

export interface User {
  id: string
  name: string
  email: string
  createdAt: ISODateString
  updatedAt: ISODateString
}

import { z } from "zod"

import { idSchema, isoDateStringSchema } from "./common"

export const userSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  email: z.email(),
  createdAt: isoDateStringSchema,
  updatedAt: isoDateStringSchema,
})

export type User = z.infer<typeof userSchema>

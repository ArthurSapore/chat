import { z } from "zod"

export const isoDateStringSchema = z.iso.datetime()
export type ISODateString = z.infer<typeof isoDateStringSchema>

/** Ids opacos (uuid, cuid, etc). Só garante que não é vazio nem absurdo. */
export const idSchema = z.string().trim().min(1).max(128)

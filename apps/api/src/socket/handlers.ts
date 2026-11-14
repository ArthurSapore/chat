import type { Ack } from "@workspace/contracts"
import type { z } from "zod"

import { AppError, toApiError } from "@/shared/errors"

/**
 * Envolve um handler de evento COM ack:
 *  - valida o payload com o schema (o cliente não é confiável);
 *  - converte retorno/erros no formato `Ack<T>`;
 *  - nunca deixa uma exceção escapar para o Socket.IO.
 *
 * O handler só se preocupa com a regra de negócio.
 */
export function withAck<TSchema extends z.ZodType, TResult>(
  schema: TSchema,
  handler: (input: z.output<TSchema>) => Promise<TResult> | TResult
) {
  return async (payload: unknown, ack?: (response: Ack<TResult>) => void) => {
    // Um cliente mal-comportado pode emitir sem callback.
    const reply = typeof ack === "function" ? ack : () => {}

    try {
      const parsed = schema.safeParse(payload)
      if (!parsed.success) throw AppError.validation(parsed.error)

      reply({ ok: true, data: await handler(parsed.data) })
    } catch (error) {
      const { body, isUnexpected } = toApiError(error)
      if (isUnexpected) console.error("[socket] erro inesperado:", error)
      reply({ ok: false, error: body })
    }
  }
}

/**
 * Envolve um handler de evento SEM ack (ex.: typing). Payload inválido é
 * descartado em silêncio: não há a quem responder.
 */
export function withValidation<TSchema extends z.ZodType>(
  schema: TSchema,
  handler: (input: z.output<TSchema>) => Promise<void> | void
) {
  return async (payload: unknown) => {
    const parsed = schema.safeParse(payload)
    if (!parsed.success) return

    try {
      await handler(parsed.data)
    } catch (error) {
      if (toApiError(error).isUnexpected) {
        console.error("[socket] erro inesperado:", error)
      }
    }
  }
}

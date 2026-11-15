import {
  format,
  isSameDay,
  isSameYear,
  isValid,
  parseISO,
  subDays,
} from "date-fns"
import { ptBR } from "date-fns/locale"

/** Datas aceitas: `Date`, timestamp ou string ISO (como trafegam na API). */
export type DateInput = Date | number | string

export function toDate(value: DateInput): Date {
  const date = typeof value === "string" ? parseISO(value) : new Date(value)
  if (!isValid(date)) throw new RangeError(`Invalid date: ${String(value)}`)
  return date
}

/** "14:05" */
export function formatTime(value: DateInput): string {
  return format(toDate(value), "HH:mm")
}

/** "14/11/2026, 14:05" */
export function formatDateTime(value: DateInput): string {
  return format(toDate(value), "dd/MM/yyyy, HH:mm")
}

/** Mesmo dia do calendário, no fuso local. */
export function isSameCalendarDay(left: DateInput, right: DateInput): boolean {
  return isSameDay(toDate(left), toDate(right))
}

/**
 * Dia por extenso relativo a `now`: "Hoje", "Ontem", "14 de novembro" (mesmo
 * ano) ou "1 de janeiro de 2025" (outro ano).
 */
export function formatFuzzyDay(value: DateInput, now: DateInput = new Date()) {
  const date = toDate(value)
  const reference = toDate(now)

  if (isSameDay(date, reference)) return "Hoje"
  if (isSameDay(date, subDays(reference, 1))) return "Ontem"

  return isSameYear(date, reference)
    ? format(date, "d 'de' MMMM", { locale: ptBR })
    : format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR })
}

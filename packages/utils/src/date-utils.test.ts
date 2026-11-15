import { describe, expect, it } from "vitest"

import {
  formatDateTime,
  formatFuzzyDay,
  formatTime,
  isSameCalendarDay,
  toDate,
} from "./date-utils"

// Local dates (new Date(y, m, d, h)) keep the tests independent of the
// machine's time zone.
const NOW = new Date(2026, 10, 14, 15, 0)

describe("toDate", () => {
  it("accepts Date, timestamp and ISO string", () => {
    const date = new Date(2026, 0, 5, 10, 30)

    expect(toDate(date).getTime()).toBe(date.getTime())
    expect(toDate(date.getTime()).getTime()).toBe(date.getTime())
    expect(toDate(date.toISOString()).getTime()).toBe(date.getTime())
  })

  it("throws for an invalid date", () => {
    expect(() => toDate("not-a-date")).toThrow(RangeError)
  })
})

describe("formatTime / formatDateTime", () => {
  it("formats time as HH:mm", () => {
    expect(formatTime(new Date(2026, 10, 14, 9, 5))).toBe("09:05")
  })

  it("formats date and time as dd/MM/yyyy, HH:mm", () => {
    expect(formatDateTime(new Date(2026, 10, 14, 9, 5))).toBe(
      "14/11/2026, 09:05"
    )
  })
})

describe("isSameCalendarDay", () => {
  it("compares calendar days, not 24h windows", () => {
    expect(
      isSameCalendarDay(
        new Date(2026, 10, 14, 0, 1),
        new Date(2026, 10, 14, 23, 59)
      )
    ).toBe(true)
    expect(
      isSameCalendarDay(
        new Date(2026, 10, 13, 23, 59),
        new Date(2026, 10, 14, 0, 1)
      )
    ).toBe(false)
  })
})

describe("formatFuzzyDay", () => {
  it.each([
    ["today", new Date(2026, 10, 14, 0, 5), "Hoje"],
    ["yesterday", new Date(2026, 10, 13, 23, 59), "Ontem"],
    ["another day this year", new Date(2026, 10, 1, 12), "1 de novembro"],
    ["another year", new Date(2025, 0, 1, 12), "1 de janeiro de 2025"],
  ])("returns the label for %s", (_, date, expected) => {
    expect(formatFuzzyDay(date, NOW)).toBe(expected)
  })

  it("handles yesterday across a month boundary", () => {
    expect(
      formatFuzzyDay(new Date(2026, 9, 31, 20), new Date(2026, 10, 1, 8))
    ).toBe("Ontem")
  })

  it("accepts ISO strings", () => {
    expect(formatFuzzyDay(NOW.toISOString(), NOW)).toBe("Hoje")
  })
})

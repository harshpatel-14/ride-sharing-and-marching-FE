import { z } from 'zod'

/**
 * Money is a DECIMAL STRING end to end — "320.00", never 320. (§11)
 *
 * The backend stores Decimal(10,2) and serialises to a string precisely so the
 * client cannot reintroduce binary-floating-point error. `Number("1200.55")`
 * is 1200.5500000000001; multiply that by anything and the cost split stops
 * reconciling with the audit trail that exists to settle disputes.
 *
 * So this module formats and compares strings. It never parses one into a
 * number, and it never does arithmetic — the split is the server's.
 */

const DECIMAL_RE = /^-?\d+(\.\d{1,2})?$/

export const decimalStringSchema = z
  .string()
  .regex(DECIMAL_RE, 'Expected a decimal amount with at most 2 decimal places')

export const isDecimalString = (value: string): boolean => DECIMAL_RE.test(value.trim())

/**
 * `Intl.NumberFormat.format` accepts a string and formats it exactly,
 * without ever going through a double. That is why the argument is a string
 * and why there is no `Number(...)` here.
 */
export function formatMoney(amount: string, currency = 'INR', locale = 'en-IN'): string {
  const trimmed = amount.trim()
  if (!isDecimalString(trimmed)) return amount

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  /*
   * `format` accepts a decimal STRING at runtime (ES2023) and formats it
   * exactly — no double in the path. TypeScript's lib types still declare
   * only `number | bigint`, so the cast asserts a real capability rather than
   * papering over a bug. Converting to a number instead would be the actual
   * bug: 1200.55 does not survive the round trip.
   */
  return (formatter.format as unknown as (value: string) => string)(trimmed)
}

/** Normalises user input ("1200", "1200.5") to the wire form ("1200.00"). */
export function toWireAmount(input: string): string | null {
  const trimmed = input.trim()
  if (!DECIMAL_RE.test(trimmed) || trimmed.startsWith('-')) return null

  const [whole = '0', fraction = ''] = trimmed.split('.')
  return `${whole}.${fraction.padEnd(2, '0')}`
}

/**
 * Compares two decimal strings without converting either to a number.
 * Returns a negative number, zero, or a positive number, like a comparator.
 *
 * Used to tell a rider their share went UP after someone cancelled — the
 * backend guide is explicit that a silently increasing charge is what people
 * dispute, so the UI has to be able to detect the direction of the change.
 */
export function compareAmounts(a: string, b: string): number {
  const norm = (v: string) => {
    const wire = toWireAmount(v)
    if (wire === null) return null
    const [whole = '0', fraction = '00'] = wire.split('.')
    return BigInt(whole) * 100n + BigInt(fraction)
  }

  const left = norm(a)
  const right = norm(b)
  if (left === null || right === null) return 0
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/** True when `next` is strictly larger than `previous`. */
export const hasIncreased = (previous: string, next: string): boolean =>
  compareAmounts(previous, next) < 0

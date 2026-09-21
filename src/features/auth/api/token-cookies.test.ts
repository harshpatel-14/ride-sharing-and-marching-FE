/**
 * @vitest-environment node
 *
 * These exercise server-only modules. Under jsdom a `window` exists, so
 * `lib/env` correctly refuses to expose API_URL — the guard is right and the
 * environment was wrong.
 */
import { describe, expect, it } from 'vitest'
import { secondsUntilExpiry } from './token-cookies.server'

/** Builds an unsigned JWT-shaped token; only the payload is ever read. */
function tokenWithExp(expSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64url')
  return `header.${payload}.signature`
}

describe('secondsUntilExpiry', () => {
  const now = 1_800_000_000_000 // fixed clock

  it('reports time remaining on a live token', () => {
    const token = tokenWithExp(Math.trunc(now / 1000) + 900)
    expect(secondsUntilExpiry(token, now)).toBe(900)
  })

  it('goes negative once expired', () => {
    const token = tokenWithExp(Math.trunc(now / 1000) - 60)
    expect(secondsUntilExpiry(token, now)).toBe(-60)
  })

  /**
   * This reads the claim without verifying the signature, so it must never
   * gate anything but "refresh early?". Malformed input returns null rather
   * than a number that could be mistaken for a decision.
   */
  it.each(['', 'not-a-jwt', 'a.b', 'a.!!!notbase64!!!.c'])('returns null for %o', (token) => {
    expect(secondsUntilExpiry(token, now)).toBeNull()
  })

  it('returns null when the payload carries no exp', () => {
    const noExp = `header.${Buffer.from(JSON.stringify({ sub: 'x' })).toString('base64url')}.sig`
    expect(secondsUntilExpiry(noExp, now)).toBeNull()
  })
})

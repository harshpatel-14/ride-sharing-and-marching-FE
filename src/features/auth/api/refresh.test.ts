/**
 * @vitest-environment node
 *
 * These exercise server-only modules. Under jsdom a `window` exists, so
 * `lib/env` correctly refuses to expose API_URL — the guard is right and the
 * environment was wrong.
 */
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/mocks/server'
import { __resetRefreshState, refreshTokens, shouldRefresh } from './auth.server'

const tokens = (suffix: string) => ({
  accessToken: `access-${suffix}`,
  refreshToken: `refresh-${suffix}`,
  tokenType: 'Bearer' as const,
  expiresIn: 900,
})

function tokenExpiringIn(seconds: number): string {
  const exp = Math.trunc(Date.now() / 1000) + seconds
  return `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.sig`
}

beforeEach(() => __resetRefreshState())

describe('refreshTokens — single flight (docs/FRONTEND.md "Refresh rotation")', () => {
  /**
   * THE most important test in the auth layer.
   *
   * A refresh token is single-use, and the backend treats two concurrent
   * refreshes with the same token as theft — it revokes every session for
   * that user. One page render fans out into several parallel API calls, so
   * without a shared in-flight promise this is not a rare race, it is the
   * normal case. The guide calls it "the single most likely way to break the
   * client".
   */
  it('fires exactly ONE request for many concurrent callers', async () => {
    let calls = 0
    server.use(
      http.post('*/auth/refresh', async () => {
        calls += 1
        // Hold the response open so all callers pile up on the same promise.
        await new Promise((resolve) => setTimeout(resolve, 50))
        return HttpResponse.json({ user: null, tokens: tokens('rotated') })
      }),
    )

    const results = await Promise.all(
      Array.from({ length: 8 }, () => refreshTokens('the-same-token')),
    )

    expect(calls).toBe(1)
    // Every caller gets the same rotated pair — nobody is left with a dead token.
    for (const result of results) {
      expect(result.accessToken).toBe('access-rotated')
      expect(result.refreshToken).toBe('refresh-rotated')
    }
  })

  /**
   * The bug a ten-way concurrency test found, reduced to a unit test.
   *
   * A request that arrives just AFTER a refresh completes still carries the
   * spent token — its cookie was sent before the rotated one came back. Without
   * the grace cache it refreshes again, the backend sees one secret used twice
   * and revokes every session for that user.
   */
  it('does not re-refresh a token it already exchanged moments ago', async () => {
    let calls = 0
    server.use(
      http.post('*/auth/refresh', () => {
        calls += 1
        return HttpResponse.json({ user: null, tokens: tokens('rotated') })
      }),
    )

    const first = await refreshTokens('spent-token')
    // Sequential, not concurrent: the in-flight lock has already been released.
    const second = await refreshTokens('spent-token')
    const third = await refreshTokens('spent-token')

    expect(calls).toBe(1)
    expect(second).toEqual(first)
    expect(third).toEqual(first)
  })

  it('releases the lock so a later expiry can refresh again', async () => {
    let calls = 0
    server.use(
      http.post('*/auth/refresh', () => {
        calls += 1
        return HttpResponse.json({ user: null, tokens: tokens(`n${calls}`) })
      }),
    )

    await refreshTokens('token-a')
    await refreshTokens('token-b')

    expect(calls).toBe(2)
  })

  it('does not wedge the lock when a refresh fails', async () => {
    let calls = 0
    server.use(
      http.post('*/auth/refresh', () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json(
              { error: { code: 'UNAUTHENTICATED', message: 'reused' }, requestId: 'r' },
              { status: 401 },
            )
          : HttpResponse.json({ user: null, tokens: tokens('recovered') })
      }),
    )

    await expect(refreshTokens('token-x')).rejects.toThrow()
    // A failed refresh must clear the in-flight entry, or every later attempt
    // would await a permanently rejected promise.
    await expect(refreshTokens('token-x')).resolves.toMatchObject({
      accessToken: 'access-recovered',
    })
  })
})

describe('shouldRefresh — refresh early, not on failure', () => {
  it('refreshes when there is no token at all', () => {
    expect(shouldRefresh(undefined)).toBe(true)
  })

  it('refreshes inside the skew window rather than waiting for a 401', () => {
    expect(shouldRefresh(tokenExpiringIn(30))).toBe(true)
  })

  it('leaves a healthy token alone', () => {
    expect(shouldRefresh(tokenExpiringIn(600))).toBe(false)
  })

  it('refreshes an already-expired token', () => {
    expect(shouldRefresh(tokenExpiringIn(-10))).toBe(true)
  })

  /** An unreadable token is not something to guess about — let the API reject it. */
  it('does not refresh on an unparseable token', () => {
    expect(shouldRefresh('garbage')).toBe(false)
  })
})

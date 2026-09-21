import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { ResponseCookies } from 'next/dist/server/web/spec-extension/cookies'
import {
  API_VERSION_PREFIX,
  endpoints,
  isTokenExpired,
  isUnauthenticated,
  request,
  requestWithStatus,
  type HttpMethod,
  type ResponseWithStatus,
} from '@/lib/api'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { authResultSchema, meResponseSchema, tokensSchema, type AuthResult, type Tokens, type User } from '../schemas'
import { readTokens, secondsUntilExpiry, writeTokens } from './token-cookies.server'

/** Absolute base for the Express service, e.g. http://api:4000/api/v1. */
const apiBase = () => `${env.API_URL}${API_VERSION_PREFIX}`

const authed = (accessToken: string) => ({
  baseUrl: apiBase(),
  headers: { Authorization: `Bearer ${accessToken}` },
})

/* ────────────────────────────────────────────────────────────────────────
 * Single-flight refresh
 *
 * A refresh token is SINGLE USE, and the backend treats two concurrent
 * refreshes with the same token as theft — it revokes every session for that
 * user. docs/FRONTEND.md calls this "the single most likely way to break the
 * client", and it is a real hazard here because one page render can fan out
 * into several parallel API calls.
 *
 * So every caller within this process awaits one shared promise per refresh
 * token. Exactly one request goes out.
 *
 * LIMIT, stated plainly: this lock is per process. Two Next instances behind a
 * load balancer could still race. Fixing that properly needs a shared lock
 * (Redis) or refresh confined to a single sticky route. For a single-instance
 * deployment this is sufficient; see README before scaling out.
 * ──────────────────────────────────────────────────────────────────────── */
const inFlight = new Map<string, Promise<Tokens>>()

/**
 * Recently-rotated tokens, keyed by the refresh token they REPLACED.
 *
 * The in-flight map alone is not enough, and this was caught by a concurrency
 * test rather than by reading the code. The failure:
 *
 *   1. The browser fires several parallel requests, all carrying cookie RT-1.
 *   2. Request A refreshes; the backend rotates RT-1 -> RT-2 and A's response
 *      carries the new cookie.
 *   3. Request B arrives just AFTER A finished, so the in-flight entry is gone
 *      — but B's cookie was sent before A's response came back, so it still
 *      says RT-1.
 *   4. B refreshes with the spent RT-1. The backend sees one secret used twice,
 *      calls it theft, and revokes EVERY session for that user.
 *
 * Measured: ten parallel calls produced five refreshes and a reuse flag. So we
 * remember what each spent token was exchanged for and hand back the same
 * result for a short grace period.
 *
 * TRADE-OFF, stated plainly: within the grace window a replay of the spent
 * token gets the rotated pair from this cache instead of tripping the
 * backend's theft detection. That is acceptable here because the token lives
 * in an httpOnly cookie only this BFF ever reads — an attacker able to present
 * it already holds the session. The window is deliberately short.
 */
const ROTATION_GRACE_MS = 30_000
const recentlyRotated = new Map<string, { tokens: Tokens; at: number }>()

function pruneRotated(now: number): void {
  for (const [token, entry] of recentlyRotated) {
    if (now - entry.at > ROTATION_GRACE_MS) recentlyRotated.delete(token)
  }
}

export async function refreshTokens(refreshToken: string): Promise<Tokens> {
  const now = Date.now()
  pruneRotated(now)

  // Already exchanged this one moments ago: reuse the result, do not ask again.
  const rotated = recentlyRotated.get(refreshToken)
  if (rotated) return rotated.tokens

  // A refresh for this token is already in the air: await the same promise.
  const existing = inFlight.get(refreshToken)
  if (existing) return existing

  const pending = (async () => {
    try {
      const raw = await request<unknown>('POST', endpoints.auth.refresh, {
        body: { refreshToken },
        options: { baseUrl: apiBase() },
      })
      const tokens = tokensSchema.parse((raw as { tokens: unknown }).tokens)

      recentlyRotated.set(refreshToken, { tokens, at: Date.now() })
      logger.info('auth.refreshed')
      return tokens
    } finally {
      // Clear before anyone observes the result, so a later expiry can refresh
      // again — and so a FAILED refresh does not wedge the lock permanently.
      inFlight.delete(refreshToken)
    }
  })()

  inFlight.set(refreshToken, pending)
  return pending
}

/** Test seam: the caches are process-global and would otherwise leak across tests. */
export function __resetRefreshState(): void {
  inFlight.clear()
  recentlyRotated.clear()
}

/** Refresh early rather than on failure: one round trip instead of two. */
const REFRESH_SKEW_SECONDS = 60

export function shouldRefresh(accessToken: string | undefined): boolean {
  if (!accessToken) return true
  const remaining = secondsUntilExpiry(accessToken)
  // An unreadable token is not something to guess about — let the API reject it.
  if (remaining === null) return false
  return remaining <= REFRESH_SKEW_SECONDS
}

/**
 * Ensures a usable access token, refreshing and persisting if needed.
 * `jar` is required because only a route handler or middleware may set cookies.
 */
export async function ensureAccessToken(jar: ResponseCookies): Promise<string | null> {
  const { accessToken, refreshToken } = await readTokens()

  if (accessToken && !shouldRefresh(accessToken)) return accessToken
  if (!refreshToken) return accessToken ?? null

  try {
    const tokens = await refreshTokens(refreshToken)
    writeTokens(jar, tokens)
    return tokens.accessToken
  } catch (error) {
    // A replayed or aged-out refresh token means the session is genuinely over.
    if (isUnauthenticated(error) || isTokenExpired(error)) {
      logger.info('auth.refresh_rejected')
      return null
    }
    throw error
  }
}

/* ── reads ────────────────────────────────────────────────────────────── */

/**
 * Current user, for Server Components.
 *
 * `cache()` dedupes across every RSC in one request, so a layout, a page and
 * three components share a single /me call.
 *
 * It cannot refresh — Server Components may not set cookies — so middleware
 * keeps the access token fresh before the render begins. If the token is dead
 * anyway this returns null and the caller redirects.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const { accessToken } = await readTokens()
  if (!accessToken) return null

  try {
    const raw = await request<unknown>('GET', endpoints.me.profile, { options: authed(accessToken) })
    return meResponseSchema.parse(raw).user
  } catch (error) {
    logger.debug('auth.me_failed', { expired: isTokenExpired(error) })
    return null
  }
})

export async function requireUser(returnTo?: string): Promise<User> {
  const user = await getCurrentUser()
  if (!user) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login')
  }
  return user
}

/* ── writes (route handlers only) ─────────────────────────────────────── */

export async function login(body: { email: string; password: string }): Promise<AuthResult> {
  const raw = await request<unknown>('POST', endpoints.auth.login, {
    body,
    options: { baseUrl: apiBase() },
  })
  return authResultSchema.parse(raw)
}

export async function register(body: {
  email: string
  password: string
  fullName: string
  phone: string
}): Promise<AuthResult> {
  const raw = await request<unknown>('POST', endpoints.auth.register, {
    body,
    options: { baseUrl: apiBase() },
  })
  return authResultSchema.parse(raw)
}

/** Idempotent server-side: an unknown token still returns 200. */
export async function logout(refreshToken: string): Promise<void> {
  try {
    await request<unknown>('POST', endpoints.auth.logout, {
      body: { refreshToken },
      options: { baseUrl: apiBase() },
    })
  } catch (error) {
    // Never block sign-out on the API. The cookies get cleared regardless —
    // a user who clicked "log out" must end up logged out locally.
    logger.warn('auth.logout_api_failed', { message: (error as Error).message })
  }
}

/** Authenticated passthrough. */
export async function callApi<T>(
  method: HttpMethod,
  path: string,
  init: { body?: unknown; accessToken: string; query?: Record<string, string> },
): Promise<T> {
  return request<T>(method, path, {
    ...(init.body !== undefined ? { body: init.body } : {}),
    options: { ...authed(init.accessToken), ...(init.query ? { query: init.query } : {}) },
  })
}

/**
 * As callApi, but keeps the upstream status so the proxy can relay it
 * verbatim. A proxy that turns every 201 into a 200 is lying about what the
 * API did, even if no current caller notices.
 */
export async function callApiWithStatus<T>(
  method: HttpMethod,
  path: string,
  init: { body?: unknown; accessToken: string; query?: Record<string, string> },
): Promise<ResponseWithStatus<T>> {
  return requestWithStatus<T>(method, path, {
    ...(init.body !== undefined ? { body: init.body } : {}),
    options: { ...authed(init.accessToken), ...(init.query ? { query: init.query } : {}) },
  })
}

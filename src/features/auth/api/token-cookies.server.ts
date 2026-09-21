import 'server-only'
import { cookies } from 'next/headers'
import type { ResponseCookies } from 'next/dist/server/web/spec-extension/cookies'
import { isProduction } from '@/lib/env'
import type { Tokens } from '../schemas'
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../cookie-names'

/**
 * Token storage. (§4, docs/FRONTEND.md "Storage")
 *
 * Both tokens live in httpOnly cookies set by our own BFF, which is the option
 * the backend guide recommends over localStorage. The browser cannot read
 * either one, so an XSS cannot exfiltrate a session.
 *
 * `sameSite: 'lax'` rather than 'strict': strict breaks returning to the app
 * from an emailed booking confirmation, which this product will want.
 */

export { ACCESS_COOKIE, REFRESH_COOKIE } from '../cookie-names'

/** Refresh tokens outlive access tokens; the API ages them out server-side. */
const REFRESH_MAX_AGE_S = 60 * 60 * 24 * 30

const baseCookie = {
  httpOnly: true,
  secure: isProduction(),
  sameSite: 'lax',
  path: '/',
} as const

export async function readTokens(): Promise<{ accessToken?: string; refreshToken?: string }> {
  const store = await cookies()
  const result: { accessToken?: string; refreshToken?: string } = {}
  const access = store.get(ACCESS_COOKIE)?.value
  const refresh = store.get(REFRESH_COOKIE)?.value
  if (access) result.accessToken = access
  if (refresh) result.refreshToken = refresh
  return result
}

/**
 * Writes both tokens onto a response.
 *
 * Takes the cookie jar explicitly because a Server Component may not mutate
 * cookies — only route handlers and middleware may, and both hand us one.
 * Making that a parameter turns "where can I refresh?" into a type error
 * rather than a runtime surprise.
 */
export function writeTokens(jar: ResponseCookies, tokens: Tokens): void {
  jar.set(ACCESS_COOKIE, tokens.accessToken, {
    ...baseCookie,
    // The API's own expiry governs; the cookie just needs to outlive the request.
    maxAge: tokens.expiresIn,
  })
  jar.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseCookie,
    maxAge: REFRESH_MAX_AGE_S,
  })
}

export function clearTokens(jar: ResponseCookies): void {
  jar.set(ACCESS_COOKIE, '', { ...baseCookie, maxAge: 0 })
  jar.set(REFRESH_COOKIE, '', { ...baseCookie, maxAge: 0 })
}

/**
 * Seconds until the access token expires, read from the JWT's `exp`.
 *
 * This only *reads* the claim — it does not verify the signature, and must
 * never be used to decide anything but "should I refresh early?". The API
 * verifies for real on every call.
 */
export function secondsUntilExpiry(accessToken: string, now: number = Date.now()): number | null {
  const payload = accessToken.split('.')[1]
  if (!payload) return null

  try {
    const json = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { exp?: number }
    if (typeof json.exp !== 'number') return null
    return json.exp - Math.trunc(now / 1000)
  } catch {
    return null
  }
}

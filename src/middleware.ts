import { NextResponse, type NextRequest } from 'next/server'
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/features/auth/cookie-names'

/**
 * Edge gate for authenticated routes. (§4)
 *
 * It does exactly one thing: if there is no session cookie at all, redirect to
 * /login with a `next` param. It does NOT validate the token — validation is
 * the API's job, and pretending otherwise here would be a second, weaker
 * implementation of authentication.
 *
 * Why it does not refresh: middleware runs on the Edge runtime, where the
 * single-flight lock in auth.server cannot be shared. Two parallel requests
 * would each refresh, and the backend treats a reused refresh token as theft
 * and revokes every session — the exact failure docs/FRONTEND.md warns about.
 * So refresh happens only in the BFF proxy (Node runtime, one shared lock),
 * and a Server Component with a stale token simply renders as signed-out and
 * redirects. One extra hop, no risk of logging the user out everywhere.
 */
export function middleware(request: NextRequest) {
  const hasSession =
    request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE)

  if (hasSession) return NextResponse.next()

  const login = new URL('/login', request.url)
  const { pathname, search } = request.nextUrl
  if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`)

  return NextResponse.redirect(login)
}

export const config = {
  /**
   * Authenticated areas only. Everything else — the landing page, /login,
   * /register, static assets, and the BFF routes that must stay reachable
   * while signed out — is excluded.
   */
  matcher: ['/rides/:path*', '/bookings/:path*', '/search/:path*', '/dashboard/:path*'],
}

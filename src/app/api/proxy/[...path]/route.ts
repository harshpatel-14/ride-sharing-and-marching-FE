import { NextResponse, type NextRequest } from 'next/server'
import { ensureAccessToken, callApi, clearTokens } from '@/features/auth/server'
import { errorResponse } from '@/lib/api/bff'
import { isTokenExpired } from '@/lib/api'

/**
 * Authenticated passthrough to the Express API. (§4)
 *
 * Every client-side call goes through here, which is what keeps the access
 * token out of JavaScript entirely. The handler:
 *
 *   1. ensures a fresh access token (single-flight refresh, see auth.server)
 *   2. forwards the request with `Authorization: Bearer`
 *   3. on TOKEN_EXPIRED — a token that died mid-flight — refreshes once and
 *      retries, exactly as docs/FRONTEND.md prescribes
 *   4. persists any rotated tokens onto the response
 *
 * Errors come back in the backend's own envelope so the client parses one
 * format regardless of which hop failed.
 */

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const apiPath = `/${path.join('/')}`
  const query = Object.fromEntries(request.nextUrl.searchParams.entries())
  const method = request.method as Method

  let body: unknown
  if (method !== 'GET' && method !== 'DELETE') {
    const text = await request.text()
    body = text.length > 0 ? (JSON.parse(text) as unknown) : undefined
  }

  // Placeholder response: the cookie jar we hand to the refresh path. Any
  // rotated tokens land here and are copied onto whatever we finally return.
  const cookieCarrier = NextResponse.next()

  try {
    const accessToken = await ensureAccessToken(cookieCarrier.cookies)

    if (!accessToken) {
      const unauth = NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Not signed in' }, requestId: null },
        { status: 401 },
      )
      clearTokens(unauth.cookies)
      return unauth
    }

    let data: unknown
    try {
      data = await callApi(method, apiPath, { accessToken, body, query })
    } catch (error) {
      // The token expired between our check and the call. Refresh once, retry once.
      if (!isTokenExpired(error)) throw error

      const retried = await ensureAccessToken(cookieCarrier.cookies)
      if (!retried) throw error
      data = await callApi(method, apiPath, { accessToken: retried, body, query })
    }

    const response = NextResponse.json(data ?? {})
    copyCookies(cookieCarrier, response)
    return response
  } catch (error) {
    const response = errorResponse(error)
    copyCookies(cookieCarrier, response)
    return response
  }
}

/** Carries rotated token cookies onto the outgoing response. */
function copyCookies(from: NextResponse, to: NextResponse): void {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie)
  }
}

export const GET = handle
export const POST = handle
export const PATCH = handle
export const PUT = handle
export const DELETE = handle

import 'server-only'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'
import { request, type RequestOptions } from './client'

/**
 * Server-side API client for RSCs and route handlers. (§4, §5.4)
 *
 * Differences from the browser client:
 *  - Talks to the INTERNAL address (http://api:4000), not the public one.
 *  - Forwards the session cookie explicitly — there is no ambient cookie jar
 *    on the server, so `credentials: 'include'` does nothing here.
 *
 * `import 'server-only'` makes importing this from a Client Component a build
 * error rather than a confusing runtime failure.
 */

export const SESSION_COOKIE = 'rs_session'

async function withSessionCookie(options: RequestOptions = {}): Promise<RequestOptions> {
  const store = await cookies()
  const session = store.get(SESSION_COOKIE)?.value

  return {
    ...options,
    baseUrl: env.API_URL,
    headers: {
      ...options.headers,
      ...(session ? { Cookie: `${SESSION_COOKIE}=${session}` } : {}),
    },
  }
}

export const serverApi = {
  get: async <T>(path: string, options?: RequestOptions) =>
    request<T>('GET', path, { options: await withSessionCookie(options) }),
  post: async <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, { body, options: await withSessionCookie(options) }),
  patch: async <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, { body, options: await withSessionCookie(options) }),
  delete: async <T>(path: string, options?: RequestOptions) =>
    request<T>('DELETE', path, { options: await withSessionCookie(options) }),
}

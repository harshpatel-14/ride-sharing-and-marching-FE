import { v7 as uuidv7 } from 'uuid'
import { ApiError, codeForStatus, type ApiErrorCode, type FieldError } from './errors'
import { logger } from '@/lib/logger'

/**
 * The single outbound HTTP path.
 *
 * Responsibilities: base URL, timeout, request-ID correlation, and turning
 * every non-2xx into a typed ApiError from the backend's envelope.
 *
 * Explicitly NOT a responsibility: retries. Booking is not idempotent — a
 * retried POST can claim a second seat. Retry policy is per-mutation. (§6.1)
 *
 * Also not a responsibility: tokens. In the browser this talks to the Next BFF
 * proxy, which holds the tokens in httpOnly cookies; on the server the caller
 * passes an Authorization header explicitly. Neither path lets a token reach
 * JavaScript that an XSS could read.
 */

const DEFAULT_TIMEOUT_MS = 15_000

export interface RequestOptions {
  signal?: AbortSignal | undefined
  timeoutMs?: number | undefined
  headers?: Record<string, string> | undefined
  baseUrl?: string | undefined
  query?: Record<string, string | number | boolean | undefined> | undefined
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const rel = path.startsWith('/') ? path : `/${path}`
  const qs = new URLSearchParams()

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) qs.set(key, String(value))
    }
  }

  const suffix = qs.size > 0 ? `?${qs.toString()}` : ''

  // Relative bases (the BFF proxy) must stay relative; absolute ones are parsed
  // so a path traversal in `path` cannot escape the host.
  if (base.startsWith('/') || base === '') return `${base}${rel}${suffix}`
  return `${new URL(base + rel).toString()}${suffix}`
}

/** The backend's error envelope: `{ error: { code, message, details }, requestId }`. */
interface ErrorEnvelope {
  error?: { code?: string; message?: string; details?: FieldError[] }
  requestId?: string
}

async function toApiError(response: Response, fallbackRequestId: string): Promise<ApiError> {
  let body: ErrorEnvelope = {}
  try {
    body = (await response.json()) as ErrorEnvelope
  } catch {
    // Non-JSON body (proxy timeout, HTML error page). The status still tells us enough.
  }

  return new ApiError({
    status: response.status,
    code: (body.error?.code as ApiErrorCode | undefined) ?? codeForStatus(response.status),
    message: body.error?.message ?? response.statusText ?? 'Request failed',
    details: body.error?.details ?? [],
    requestId: body.requestId ?? response.headers.get('x-request-id') ?? fallbackRequestId,
  })
}

export async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  init: { body?: unknown; options?: RequestOptions | undefined } = {},
): Promise<T> {
  const { body, options = {} } = init
  const baseUrl = options.baseUrl ?? ''

  // UUIDv7 is time-ordered, so request ids sort chronologically in a log search.
  const requestId = uuidv7()
  const url = buildUrl(baseUrl, path, options.query)

  const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout

  const started = performance.now()

  let response: Response
  try {
    response = await fetch(url, {
      method,
      signal,
      // Sends the httpOnly session cookies to our own BFF. The browser can't read them.
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'X-Request-Id': requestId,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch (cause) {
    const timedOut = cause instanceof DOMException && cause.name === 'TimeoutError'
    logger.error('api.transport_failure', { method, path, requestId, timedOut })
    throw new ApiError({
      status: 0,
      code: timedOut ? 'TIMEOUT' : 'NETWORK',
      message: timedOut ? 'Request timed out' : 'Network request failed',
      requestId,
    })
  }

  const durationMs = Math.trunc(performance.now() - started)

  if (!response.ok) {
    const error = await toApiError(response, requestId)
    logger.warn('api.error_response', {
      method, path, requestId: error.requestId, status: error.status, code: error.code, durationMs,
    })
    throw error
  }

  logger.debug('api.ok', { method, path, requestId, status: response.status, durationMs })

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** Browser-side client. Talks to the BFF proxy, never to Express directly. */
import { BFF_PROXY_BASE } from './endpoints'

const withProxyBase = (options?: RequestOptions): RequestOptions => ({
  ...options,
  baseUrl: options?.baseUrl ?? BFF_PROXY_BASE,
})

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>('GET', path, { options: withProxyBase(options) }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, { body, options: withProxyBase(options) }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, { body, options: withProxyBase(options) }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>('DELETE', path, { options: withProxyBase(options) }),
}

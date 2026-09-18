import { v7 as uuidv7 } from 'uuid'
import { ApiError, codeForStatus, type ApiErrorCode, type FieldError } from './errors'
import { logger } from '@/lib/logger'

/**
 * The single outbound HTTP path for the browser. (§5, §13)
 *
 * Responsibilities: base URL, cookie credentials, timeout, request-ID
 * correlation, and turning every non-2xx into a typed ApiError.
 *
 * Explicitly NOT a responsibility: retries. Booking is not idempotent — a
 * retried POST can double-book a seat. Retry policy is per-mutation and lives
 * with the mutation. (§6.1)
 */

const DEFAULT_TIMEOUT_MS = 15_000

export interface RequestOptions {
  signal?: AbortSignal | undefined
  timeoutMs?: number | undefined
  headers?: Record<string, string> | undefined
  /** Absolute base override — used by the server-side client. */
  baseUrl?: string | undefined
  query?: Record<string, string | number | boolean | undefined> | undefined
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

interface ErrorBody {
  code?: string
  message?: string
  fieldErrors?: FieldError[]
  errors?: FieldError[]
}

async function toApiError(response: Response, requestId: string): Promise<ApiError> {
  let body: ErrorBody = {}
  try {
    body = (await response.json()) as ErrorBody
  } catch {
    // Non-JSON error body (proxy timeout, HTML error page). Status still tells us enough.
  }

  return new ApiError({
    status: response.status,
    code: (body.code as ApiErrorCode | undefined) ?? codeForStatus(response.status),
    message: body.message ?? response.statusText ?? 'Request failed',
    fieldErrors: body.fieldErrors ?? body.errors ?? [],
    requestId: response.headers.get('x-request-id') ?? requestId,
  })
}

export async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  init: { body?: unknown; options?: RequestOptions | undefined } = {},
): Promise<T> {
  const { body, options = {} } = init
  const baseUrl = options.baseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? ''

  // UUIDv7 is time-ordered, so request IDs sort chronologically in a log search.
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
      // Sends the httpOnly session cookie. The browser never reads it. (§4)
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
      method, path, requestId, status: error.status, code: error.code, durationMs,
    })
    throw error
  }

  logger.debug('api.ok', { method, path, requestId, status: response.status, durationMs })

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, { options }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, { body, options }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, { body, options }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, { body, options }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, { options }),
}

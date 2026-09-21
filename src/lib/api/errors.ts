/**
 * The error taxonomy, mapped to the backend contract in docs/API.md.
 *
 * Two rules from that contract shape everything here:
 *
 *  1. **Branch on `error.code`, never on `error.message`.** Messages are written
 *     for humans and will be reworded.
 *  2. **There is no 403.** Asking for someone else's record returns 404, so ids
 *     cannot be probed for existence. The UI must not reintroduce the
 *     distinction it was careful to remove.
 *
 * And the one that matters most: `409 NO_SEATS_AVAILABLE` is the *designed*
 * outcome of losing the race for the last seat, not a failure. (spec §3.3)
 */

export type ApiErrorCode =
  // validation / request shape
  | 'VALIDATION_FAILED'
  | 'MALFORMED_REQUEST'
  // auth
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_RESOURCE_OWNER'
  // absence
  | 'NOT_FOUND'
  | 'RIDE_NOT_FOUND'
  | 'BOOKING_NOT_FOUND'
  | 'USER_NOT_FOUND'
  // state conflicts
  | 'CONFLICT'
  | 'NO_SEATS_AVAILABLE'
  | 'RIDE_NOT_OPEN'
  | 'RIDE_COMPLETED_IMMUTABLE'
  | 'ALREADY_BOOKED'
  | 'EMAIL_ALREADY_REGISTERED'
  // semantics
  | 'UNPROCESSABLE'
  | 'DEPARTURE_IN_PAST'
  | 'CANNOT_BOOK_OWN_RIDE'
  // infrastructure
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  // client-side only: never sent by the API
  | 'NETWORK'
  | 'TIMEOUT'

/** `details[]` on a validation failure. `field` is a dotted path. */
export interface FieldError {
  source: 'body' | 'query' | 'params'
  field: string
  code: string
  message: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly details: FieldError[]
  /** Also returned in `x-request-id`; it finds the server log line. */
  readonly requestId: string | undefined

  constructor(init: {
    status: number
    code: ApiErrorCode
    message: string
    details?: FieldError[]
    requestId?: string | undefined
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.details = init.details ?? []
    this.requestId = init.requestId
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError

const hasCode = (e: unknown, ...codes: ApiErrorCode[]): e is ApiError =>
  isApiError(e) && codes.includes(e.code)

/* ── auth ─────────────────────────────────────────────────────────────── */

/** Access token aged out. Refresh and retry — do NOT bounce the user to login. */
export const isTokenExpired = (e: unknown): e is ApiError => hasCode(e, 'TOKEN_EXPIRED')

/** Session genuinely gone (revoked, replayed refresh token). Send them to login. */
export const isUnauthenticated = (e: unknown): e is ApiError =>
  hasCode(e, 'UNAUTHENTICATED', 'INVALID_CREDENTIALS')

/* ── absence ──────────────────────────────────────────────────────────── */

/**
 * Covers "does not exist" AND "not yours" — the backend deliberately conflates
 * them. Render "no longer available", never "deleted" and never "forbidden".
 */
export const isNotFound = (e: unknown): e is ApiError =>
  isApiError(e) && (e.status === 404 || hasCode(e, 'NOT_FOUND', 'RIDE_NOT_FOUND', 'BOOKING_NOT_FOUND', 'USER_NOT_FOUND'))

/* ── validation ───────────────────────────────────────────────────────── */

export const isValidation = (e: unknown): e is ApiError =>
  hasCode(e, 'VALIDATION_FAILED', 'MALFORMED_REQUEST')

/* ── state ────────────────────────────────────────────────────────────── */

/** Lost the race for the last seat. Expected on a popular ride. (spec §3.3) */
export const isSeatUnavailable = (e: unknown): e is ApiError => hasCode(e, 'NO_SEATS_AVAILABLE')

export const isAlreadyBooked = (e: unknown): e is ApiError => hasCode(e, 'ALREADY_BOOKED')

/** Completed ride: locked forever. Render the whole view read-only. (spec §3.6) */
export const isRideImmutable = (e: unknown): e is ApiError => hasCode(e, 'RIDE_COMPLETED_IMMUTABLE')

/** Cancelled ride. */
export const isRideNotOpen = (e: unknown): e is ApiError => hasCode(e, 'RIDE_NOT_OPEN')

/** Any terminal-ride state: the view should stop offering mutations. */
export const isRideTerminalError = (e: unknown): e is ApiError =>
  hasCode(e, 'RIDE_COMPLETED_IMMUTABLE', 'RIDE_NOT_OPEN')

export const isRateLimited = (e: unknown): e is ApiError => hasCode(e, 'RATE_LIMITED')

/**
 * User-facing copy, following the table in docs/FRONTEND.md.
 *
 * TOKEN_EXPIRED returns null on purpose: the correct response is a silent
 * refresh, so there is nothing to say to the user.
 */
export function toUserMessage(e: unknown): string {
  if (!isApiError(e)) return 'Something went wrong. Please try again.'

  switch (e.code) {
    case 'VALIDATION_FAILED':
    case 'MALFORMED_REQUEST':
      return e.details[0]?.message ?? 'Please check the details you entered.'
    case 'INVALID_CREDENTIALS':
      return 'Email or password is incorrect'
    case 'EMAIL_ALREADY_REGISTERED':
      return 'That email already has an account'
    case 'TOKEN_EXPIRED':
    case 'UNAUTHENTICATED':
      return 'Your session has ended. Please sign in again.'
    case 'FORBIDDEN':
    case 'NOT_RESOURCE_OWNER':
    case 'NOT_FOUND':
    case 'USER_NOT_FOUND':
      return 'This is no longer available'
    case 'RIDE_NOT_FOUND':
      return 'This ride is no longer available'
    case 'BOOKING_NOT_FOUND':
      return 'This booking is no longer available'
    case 'NO_SEATS_AVAILABLE':
      return 'That seat just went'
    case 'ALREADY_BOOKED':
      return 'You already have a seat on this ride'
    case 'CANNOT_BOOK_OWN_RIDE':
      return 'This is your ride'
    case 'RIDE_COMPLETED_IMMUTABLE':
      return 'This ride has finished'
    case 'RIDE_NOT_OPEN':
      return 'This ride was cancelled'
    case 'CONFLICT':
      return 'That has already been done'
    case 'DEPARTURE_IN_PAST':
      return 'Departure must be in the future'
    case 'UNPROCESSABLE':
      return e.message
    case 'RATE_LIMITED':
      return 'Too many attempts, try shortly'
    case 'SERVICE_UNAVAILABLE':
      return 'The service is temporarily unavailable. Please try again.'
    case 'TIMEOUT':
      return 'The request took too long. Please try again.'
    case 'NETWORK':
      return 'Network problem. Check your connection and try again.'
    case 'INTERNAL_ERROR':
      return 'Something went wrong'
  }
}

/** Fallback code when the body carries none. */
export function codeForStatus(status: number): ApiErrorCode {
  if (status === 400) return 'VALIDATION_FAILED'
  if (status === 401) return 'UNAUTHENTICATED'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  if (status === 422) return 'UNPROCESSABLE'
  if (status === 429) return 'RATE_LIMITED'
  if (status === 503) return 'SERVICE_UNAVAILABLE'
  return 'INTERNAL_ERROR'
}

/** Map `details[]` onto form fields: `{ 'seatsTotal': 'A ride must offer…' }`. */
export function toFieldMessages(e: unknown): Record<string, string> {
  if (!isApiError(e)) return {}
  const out: Record<string, string> = {}
  for (const detail of e.details) {
    out[detail.field] ??= detail.message
  }
  return out
}

/**
 * The error taxonomy from §6.2. Mapped once, here, so that every call site
 * agrees on what a 409 means.
 *
 * The important one: 409 is a NORMAL, DESIGNED-FOR outcome of booking the last
 * seat — not a failure. Two riders tap Book, one gets 201, one gets 409. The
 * 409 rider must see a coherent recovery path, never "Something went wrong".
 */

/** Machine-readable codes the backend sends in the response body. */
export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SEAT_UNAVAILABLE'
  | 'ALREADY_BOOKED'
  | 'RIDE_NOT_OPEN'
  | 'RIDE_COMPLETED'
  | 'RIDE_CANCELLED'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'NETWORK'
  | 'TIMEOUT'

export interface FieldError {
  path: string
  message: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly fieldErrors: FieldError[]
  /** Correlates this failure with the backend's structured trace. (§13) */
  readonly requestId: string | undefined

  constructor(init: {
    status: number
    code: ApiErrorCode
    message: string
    fieldErrors?: FieldError[]
    requestId?: string | undefined
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fieldErrors = init.fieldErrors ?? []
    this.requestId = init.requestId
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError

export const isUnauthenticated = (e: unknown) => isApiError(e) && e.status === 401
export const isForbidden = (e: unknown) => isApiError(e) && e.status === 403
export const isNotFound = (e: unknown) => isApiError(e) && e.status === 404
export const isValidation = (e: unknown) => isApiError(e) && (e.status === 400 || e.status === 422)

/** The last-seat race (spec §3.3). Expected, not exceptional. */
export const isSeatConflict = (e: unknown) =>
  isApiError(e) && e.status === 409 && (e.code === 'SEAT_UNAVAILABLE' || e.code === 'ALREADY_BOOKED')

export const isConflict = (e: unknown) => isApiError(e) && e.status === 409

/** Ride is completed or cancelled — terminal, read-only. (spec §3.6) */
export const isGone = (e: unknown) => isApiError(e) && e.status === 410

/**
 * Human-facing copy. 403 and 404 deliberately share a message: distinguishing
 * them turns the UI into an existence oracle for other people's bookings.
 */
export function toUserMessage(e: unknown): string {
  if (!isApiError(e)) return 'Something went wrong. Please try again.'

  switch (e.code) {
    case 'SEAT_UNAVAILABLE':
      return 'That seat was just taken.'
    case 'ALREADY_BOOKED':
      return 'You already have a seat on this ride.'
    case 'RIDE_COMPLETED':
      return 'This ride has been completed and can no longer be changed.'
    case 'RIDE_CANCELLED':
      return 'This ride was cancelled by the driver.'
    case 'RIDE_NOT_OPEN':
      return 'This ride is no longer accepting bookings.'
    case 'UNAUTHENTICATED':
      return 'Your session has expired. Please sign in again.'
    case 'FORBIDDEN':
    case 'NOT_FOUND':
      return "We couldn't find that, or you don't have access to it."
    case 'VALIDATION_FAILED':
      return e.fieldErrors[0]?.message ?? 'Please check the details you entered.'
    case 'RATE_LIMITED':
      return 'Too many requests. Please wait a moment.'
    case 'TIMEOUT':
      return 'The request took too long. Please try again.'
    case 'NETWORK':
      return 'Network problem. Check your connection and try again.'
    case 'INTERNAL':
      return 'Something went wrong on our side. Please try again.'
  }
}

/** Default code for a status when the backend sends no body code. */
export function codeForStatus(status: number): ApiErrorCode {
  if (status === 400 || status === 422) return 'VALIDATION_FAILED'
  if (status === 401) return 'UNAUTHENTICATED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'SEAT_UNAVAILABLE'
  if (status === 410) return 'RIDE_CANCELLED'
  if (status === 429) return 'RATE_LIMITED'
  return 'INTERNAL'
}

import { describe, expect, it } from 'vitest'
import {
  ApiError,
  codeForStatus,
  isAlreadyBooked,
  isNotFound,
  isRideImmutable,
  isRideTerminalError,
  isSeatUnavailable,
  isTokenExpired,
  isUnauthenticated,
  isValidation,
  toFieldMessages,
  toUserMessage,
  type ApiErrorCode,
} from './errors'

const err = (status: number, code: ApiErrorCode, message = 'x') =>
  new ApiError({ status, code, message })

describe('error taxonomy (§6.2, docs/API.md)', () => {
  /** The spec's sharpest requirement, seen from the client. */
  it('treats 409 NO_SEATS_AVAILABLE as the last-seat race', () => {
    const e = err(409, 'NO_SEATS_AVAILABLE')
    expect(isSeatUnavailable(e)).toBe(true)
    expect(toUserMessage(e)).toBe('That seat just went')
  })

  it('distinguishes ALREADY_BOOKED from losing the seat — different recovery', () => {
    const e = err(409, 'ALREADY_BOOKED')
    expect(isAlreadyBooked(e)).toBe(true)
    expect(isSeatUnavailable(e)).toBe(false)
  })

  it('does not classify a 500 as a seat conflict', () => {
    expect(isSeatUnavailable(err(500, 'INTERNAL_ERROR'))).toBe(false)
  })

  it('treats a completed ride as immutable and terminal', () => {
    const e = err(409, 'RIDE_COMPLETED_IMMUTABLE')
    expect(isRideImmutable(e)).toBe(true)
    expect(isRideTerminalError(e)).toBe(true)
  })

  it('treats a cancelled ride as terminal but not immutable-by-completion', () => {
    const e = err(409, 'RIDE_NOT_OPEN')
    expect(isRideTerminalError(e)).toBe(true)
    expect(isRideImmutable(e)).toBe(false)
  })

  /**
   * The backend deliberately has no 403 — "not yours" is 404 so ids cannot be
   * probed. The client must not reintroduce the distinction it removed.
   */
  it('treats not-found and not-yours identically', () => {
    expect(isNotFound(err(404, 'RIDE_NOT_FOUND'))).toBe(true)
    expect(isNotFound(err(404, 'BOOKING_NOT_FOUND'))).toBe(true)
    expect(toUserMessage(err(404, 'NOT_FOUND'))).not.toMatch(/permission|forbidden|access/i)
  })

  it('says "no longer available", never "deleted"', () => {
    expect(toUserMessage(err(404, 'RIDE_NOT_FOUND'))).toBe('This ride is no longer available')
  })

  /** TOKEN_EXPIRED means refresh-and-retry; UNAUTHENTICATED means log in again. */
  it('separates an expired access token from a dead session', () => {
    expect(isTokenExpired(err(401, 'TOKEN_EXPIRED'))).toBe(true)
    expect(isUnauthenticated(err(401, 'TOKEN_EXPIRED'))).toBe(false)
    expect(isUnauthenticated(err(401, 'UNAUTHENTICATED'))).toBe(true)
  })

  it('never reveals whether an email exists', () => {
    expect(toUserMessage(err(401, 'INVALID_CREDENTIALS'))).toBe('Email or password is incorrect')
  })

  it('surfaces the first field error for a validation failure', () => {
    const e = new ApiError({
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed',
      details: [
        { source: 'body', field: 'seatsTotal', code: 'too_small', message: 'A ride must offer at least 1 seat' },
      ],
    })
    expect(isValidation(e)).toBe(true)
    expect(toUserMessage(e)).toBe('A ride must offer at least 1 seat')
  })

  it('maps details onto form fields by dotted path', () => {
    const e = new ApiError({
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'nope',
      details: [
        { source: 'body', field: 'seatsTotal', code: 'too_small', message: 'At least 1' },
        { source: 'body', field: 'estimatedCost', code: 'invalid', message: 'Bad amount' },
        { source: 'body', field: 'seatsTotal', code: 'other', message: 'Second message ignored' },
      ],
    })
    expect(toFieldMessages(e)).toEqual({
      seatsTotal: 'At least 1',
      estimatedCost: 'Bad amount',
    })
  })

  it('falls back safely for a non-ApiError', () => {
    expect(toUserMessage(new Error('boom'))).toBe('Something went wrong. Please try again.')
  })

  it('maps bare statuses to default codes', () => {
    expect(codeForStatus(409)).toBe('CONFLICT')
    expect(codeForStatus(401)).toBe('UNAUTHENTICATED')
    expect(codeForStatus(422)).toBe('UNPROCESSABLE')
    expect(codeForStatus(503)).toBe('SERVICE_UNAVAILABLE')
  })
})

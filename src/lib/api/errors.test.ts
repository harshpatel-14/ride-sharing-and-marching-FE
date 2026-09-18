import { describe, expect, it } from 'vitest'
import {
  ApiError,
  codeForStatus,
  isForbidden,
  isGone,
  isNotFound,
  isSeatConflict,
  toUserMessage,
} from './errors'

const err = (status: number, code: Parameters<typeof toUserMessage>[0] extends never ? never : ApiError['code']) =>
  new ApiError({ status, code, message: 'x' })

describe('error taxonomy (§6.2)', () => {
  it('treats a 409 SEAT_UNAVAILABLE as the last-seat race, not a generic failure', () => {
    expect(isSeatConflict(err(409, 'SEAT_UNAVAILABLE'))).toBe(true)
    expect(toUserMessage(err(409, 'SEAT_UNAVAILABLE'))).toBe('That seat was just taken.')
  })

  it('does not classify a 500 as a seat conflict', () => {
    expect(isSeatConflict(err(500, 'INTERNAL'))).toBe(false)
  })

  it('treats 410 as a terminal ride', () => {
    expect(isGone(err(410, 'RIDE_COMPLETED'))).toBe(true)
  })

  /**
   * 403 and 404 must read identically. Distinguishing them turns the UI into an
   * existence oracle for other people's bookings.
   */
  it('gives 403 and 404 the same user-facing message', () => {
    expect(isForbidden(err(403, 'FORBIDDEN'))).toBe(true)
    expect(isNotFound(err(404, 'NOT_FOUND'))).toBe(true)
    expect(toUserMessage(err(403, 'FORBIDDEN'))).toBe(toUserMessage(err(404, 'NOT_FOUND')))
  })

  it('surfaces the first field error for validation failures', () => {
    const e = new ApiError({
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'bad',
      fieldErrors: [{ path: 'seatsTotal', message: 'Seat count must be at least 1' }],
    })
    expect(toUserMessage(e)).toBe('Seat count must be at least 1')
  })

  it('falls back to a safe message for a non-ApiError', () => {
    expect(toUserMessage(new Error('boom'))).toBe('Something went wrong. Please try again.')
  })

  it('maps statuses to default codes', () => {
    expect(codeForStatus(409)).toBe('SEAT_UNAVAILABLE')
    expect(codeForStatus(401)).toBe('UNAUTHENTICATED')
    expect(codeForStatus(503)).toBe('INTERNAL')
  })
})

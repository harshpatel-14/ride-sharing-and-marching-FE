import { describe, expect, it } from 'vitest'
import { isSeatConflict, isGone } from '@/lib/api'
import { server } from '@/mocks/server'
import { scenarios } from '@/mocks'
import { bookingsApi } from './bookings.api'

describe('bookingsApi against the mocked contract (§12)', () => {
  it('returns a confirmed booking on the happy path', async () => {
    const booking = await bookingsApi.create('00000000-0000-4000-8000-000000000100', { seats: 1 })
    expect(booking.status).toBe('CONFIRMED')
  })

  /**
   * The spec's sharpest requirement, seen from the client. Two riders tap Book
   * on the last seat; the loser must get a typed, recognisable conflict — not
   * an opaque failure that the UI renders as "Something went wrong".
   */
  it('raises a typed seat conflict when the last seat is lost', async () => {
    server.use(scenarios.seatTaken())
    await expect(bookingsApi.create('r1', { seats: 1 })).rejects.toSatisfy(isSeatConflict)
  })

  it('distinguishes a completed ride (410) from a seat conflict (409)', async () => {
    server.use(scenarios.rideCompleted())
    const error = await bookingsApi.create('r1', { seats: 1 }).catch((e: unknown) => e)
    expect(isGone(error)).toBe(true)
    expect(isSeatConflict(error)).toBe(false)
  })

  it('drops contact details when a booking is cancelled (§9, §10)', async () => {
    const cancelled = await bookingsApi.cancel('00000000-0000-4000-8000-000000000200')
    expect(cancelled.status).toBe('CANCELLED_BY_RIDER')
    expect(cancelled.contact).toBeNull()
  })

  it('rejects a malformed booking response rather than passing it on (§5.3)', async () => {
    const { http, HttpResponse } = await import('msw')
    server.use(http.post('*/rides/:rideId/bookings', () => HttpResponse.json({ id: 'not-a-uuid' })))
    await expect(bookingsApi.create('r1', { seats: 1 })).rejects.toThrow()
  })
})

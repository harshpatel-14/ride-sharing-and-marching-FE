import { describe, expect, it } from 'vitest'
import { isAlreadyBooked, isRideImmutable, isSeatUnavailable } from '@/lib/api'
import { IDS, scenarios } from '@/mocks'
import { server } from '@/mocks/server'
import { bookingsApi } from './bookings.api'

describe('bookingsApi against the mocked contract (§12)', () => {
  it('returns a confirmed booking on the happy path', async () => {
    const booking = await bookingsApi.create(IDS.ride)
    expect(booking.status).toBe('CONFIRMED')
    // Money stays a string all the way through. (§11)
    expect(booking.seatShare).toBe('160.00')
    expect(typeof booking.seatShare).toBe('string')
  })

  /**
   * The spec's sharpest requirement from the client side. Two riders tap Book
   * on the last seat; the loser must get a typed, recognisable conflict — not
   * an opaque failure the UI renders as "Something went wrong".
   */
  it('raises a typed seat conflict when the last seat is lost', async () => {
    server.use(scenarios.seatTaken())
    await expect(bookingsApi.create(IDS.ride)).rejects.toSatisfy(isSeatUnavailable)
  })

  it('distinguishes ALREADY_BOOKED from NO_SEATS_AVAILABLE', async () => {
    server.use(scenarios.alreadyBooked())
    const error = await bookingsApi.create(IDS.ride).catch((e: unknown) => e)
    expect(isAlreadyBooked(error)).toBe(true)
    expect(isSeatUnavailable(error)).toBe(false)
  })

  it('surfaces a completed ride as immutable, not as a seat conflict', async () => {
    server.use(scenarios.rideCompleted('book'))
    const error = await bookingsApi.create(IDS.ride).catch((e: unknown) => e)
    expect(isRideImmutable(error)).toBe(true)
    expect(isSeatUnavailable(error)).toBe(false)
  })

  it('freezes seatShare but zeroes amountOwed on cancellation (§11)', async () => {
    const { booking, seatsAvailable } = await bookingsApi.cancel(IDS.booking)
    expect(booking.status).toBe('CANCELLED_BY_RIDER')
    expect(booking.amountOwed).toBe('0.00')
    // The quoted share is kept as a record of what the rider was told.
    expect(booking.seatShare).toBe('160.00')
    // The seat is bookable again the instant this returns. (spec §3.4)
    expect(seatsAvailable).toBe(3)
  })

  it('rejects a malformed booking response rather than passing it on (§5.3)', async () => {
    const { http, HttpResponse } = await import('msw')
    server.use(http.post('*/rides/:rideId/bookings', () => HttpResponse.json({ booking: { id: 'nope' } })))
    await expect(bookingsApi.create(IDS.ride)).rejects.toThrow()
  })
})

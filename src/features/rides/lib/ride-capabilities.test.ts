import { describe, expect, it } from 'vitest'
import { makeRide } from '@/mocks'
import { rideCapabilities } from './ride-capabilities'

const past = new Date(Date.now() - 3_600_000).toISOString()

describe('rideCapabilities', () => {
  it('lets a rider book an open ride with seats', () => {
    expect(rideCapabilities(makeRide()).canBook).toBe(true)
  })

  /** The API returns 422 CANNOT_BOOK_OWN_RIDE; the UI should not offer it. */
  it('never lets the driver book their own ride', () => {
    expect(rideCapabilities(makeRide({ isOwner: true })).canBook).toBe(false)
  })

  it('offers no booking when the last seat is gone', () => {
    expect(rideCapabilities(makeRide({ seatsAvailable: 0, seatsTaken: 3 })).canBook).toBe(false)
  })

  it('offers no booking on a ride that already departed', () => {
    expect(rideCapabilities(makeRide({ departureAt: past })).canBook).toBe(false)
  })

  // spec §3.6 — the frontend half. Enforcement is the API plus a DB trigger.
  it.each(['COMPLETED', 'CANCELLED'] as const)('offers nothing on a %s ride', (status) => {
    const caps = rideCapabilities(makeRide({ status, isOwner: true, departureAt: past }))
    expect(caps).toMatchObject({
      canBook: false,
      canCancelRide: false,
      canEdit: false,
      canComplete: false,
    })
  })

  it('offers cancel and complete to the driver of an open ride', () => {
    const caps = rideCapabilities(makeRide({ isOwner: true }))
    expect(caps.canCancelRide).toBe(true)
    expect(caps.canComplete).toBe(true)
    expect(caps.canManageBookings).toBe(true)
  })

  it('does not let a non-owner cancel or manage someone else’s ride (spec §6)', () => {
    const caps = rideCapabilities(makeRide({ isOwner: false }))
    expect(caps.canCancelRide).toBe(false)
    expect(caps.canManageBookings).toBe(false)
  })

  /**
   * `isOwner` comes from the API. Re-deriving ownership by comparing ids here
   * would be a second implementation waiting to disagree with the first.
   */
  it('reads ownership from the payload rather than re-deriving it', () => {
    expect(rideCapabilities(makeRide({ isOwner: true })).canEdit).toBe(true)
    expect(rideCapabilities(makeRide({ isOwner: false })).canEdit).toBe(false)
  })
})

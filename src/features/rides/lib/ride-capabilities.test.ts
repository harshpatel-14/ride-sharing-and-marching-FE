import { describe, expect, it } from 'vitest'
import { makeRide, makeSession } from '@/mocks'
import { rideCapabilities } from './ride-capabilities'

const driver = makeSession({ userId: '00000000-0000-4000-8000-000000000002' })
const rider = makeSession({ userId: '00000000-0000-4000-8000-000000000009' })
const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()

describe('rideCapabilities', () => {
  it('lets a rider book an open ride with seats', () => {
    expect(rideCapabilities(makeRide(), rider).canBook).toBe(true)
  })

  it('never lets the driver book their own ride', () => {
    expect(rideCapabilities(makeRide(), driver).canBook).toBe(false)
  })

  it('never lets an anonymous visitor book — there is no anonymous path (spec §6)', () => {
    expect(rideCapabilities(makeRide(), null).canBook).toBe(false)
  })

  it('offers no booking when the last seat is gone', () => {
    expect(rideCapabilities(makeRide({ seatsAvailable: 0 }), rider).canBook).toBe(false)
  })

  // spec §3.6 — the frontend half. Enforcement itself lives in Express + Postgres.
  it.each(['COMPLETED', 'CANCELLED'] as const)('offers nothing on a %s ride', (status) => {
    const caps = rideCapabilities(makeRide({ status, departureAt: past }), driver)
    expect(caps).toMatchObject({ canBook: false, canCancelRide: false, canEdit: false })
  })

  it('does not let a completed ride be completed again', () => {
    const caps = rideCapabilities(makeRide({ status: 'COMPLETED', departureAt: past }), driver)
    expect(caps.canComplete).toBe(false)
  })

  it('lets a driver complete only after departure has passed', () => {
    expect(rideCapabilities(makeRide({ departureAt: past }), driver).canComplete).toBe(true)
    expect(rideCapabilities(makeRide(), driver).canComplete).toBe(false)
  })

  it('does not let a rider cancel someone else’s ride (spec §6)', () => {
    expect(rideCapabilities(makeRide(), rider).canCancelRide).toBe(false)
  })
})

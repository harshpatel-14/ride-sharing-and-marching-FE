import { describe, expect, it } from 'vitest'
import { makeDriverWithContact, makePublicDriver, makeRide } from '@/mocks'
import { createRideSchema, hasContact, isRideTerminal, rideSchema } from './index'

const validInput = {
  originLabel: 'Prahlad Nagar',
  originLat: 23.0103,
  originLng: 72.5074,
  destLabel: 'Vastrapur',
  destLat: 23.0364,
  destLng: 72.529,
  departureAt: new Date(Date.now() + 6 * 3_600_000).toISOString(),
  flexMinutes: 30,
  seatsTotal: 3,
  estimatedCost: '300.00',
}

describe('createRideSchema — matches POST /rides exactly', () => {
  it('accepts a well-formed ride', () => {
    expect(createRideSchema.safeParse(validInput).success).toBe(true)
  })

  it('rejects a seat count outside 1–8', () => {
    expect(createRideSchema.safeParse({ ...validInput, seatsTotal: 0 }).success).toBe(false)
    expect(createRideSchema.safeParse({ ...validInput, seatsTotal: 9 }).success).toBe(false)
  })

  it('rejects flexMinutes beyond the API maximum of 720', () => {
    expect(createRideSchema.safeParse({ ...validInput, flexMinutes: 721 }).success).toBe(false)
    expect(createRideSchema.safeParse({ ...validInput, flexMinutes: 0 }).success).toBe(true)
  })

  it('rejects out-of-range coordinates', () => {
    expect(createRideSchema.safeParse({ ...validInput, originLat: 91 }).success).toBe(false)
    expect(createRideSchema.safeParse({ ...validInput, destLng: 181 }).success).toBe(false)
  })

  /** Money goes on the wire as a decimal string, never a number. (§11) */
  it.each(['300.00', '0.00', '1200.55'])('accepts the decimal string %o', (estimatedCost) => {
    expect(createRideSchema.safeParse({ ...validInput, estimatedCost }).success).toBe(true)
  })

  it.each(['300.555', 'free', ''])('rejects the malformed amount %o', (estimatedCost) => {
    expect(createRideSchema.safeParse({ ...validInput, estimatedCost }).success).toBe(false)
  })

  it('rejects a numeric cost, which would mean a float reached the wire', () => {
    expect(createRideSchema.safeParse({ ...validInput, estimatedCost: 300 }).success).toBe(false)
  })
})

describe('rideSchema — contact visibility (§9, spec §3.7)', () => {
  it('parses a ride whose driver has no contact details', () => {
    const ride = rideSchema.parse(makeRide())
    expect(hasContact(ride.driver)).toBe(false)
    expect(ride.driver).not.toHaveProperty('phone')
    expect(ride.driver).not.toHaveProperty('email')
  })

  it('parses a ride whose driver carries contact details', () => {
    const ride = rideSchema.parse(makeRide({ driver: makeDriverWithContact() }))
    expect(hasContact(ride.driver)).toBe(true)
    expect(hasContact(ride.driver) && ride.driver.phone).toBe('+91 98111 00001')
  })

  /**
   * The union must not silently keep contact fields on the public branch —
   * if it did, `hasContact` would be true for a driver the API meant to keep
   * anonymous.
   */
  it('narrows correctly for a public driver', () => {
    expect(hasContact(makePublicDriver())).toBe(false)
  })

  it('keeps estimatedCost as a string', () => {
    const ride = rideSchema.parse(makeRide())
    expect(typeof ride.estimatedCost).toBe('string')
  })

  it('rejects a negative seat count', () => {
    expect(rideSchema.safeParse(makeRide({ seatsAvailable: -1 })).success).toBe(false)
  })

  it('has no FULL status — fullness is seatsAvailable === 0', () => {
    expect(rideSchema.safeParse(makeRide({ status: 'FULL' as never })).success).toBe(false)
  })
})

describe('isRideTerminal', () => {
  it.each([
    ['OPEN', false],
    ['COMPLETED', true],
    ['CANCELLED', true],
  ] as const)('%s -> %s', (status, expected) => {
    expect(isRideTerminal({ status })).toBe(expected)
  })
})

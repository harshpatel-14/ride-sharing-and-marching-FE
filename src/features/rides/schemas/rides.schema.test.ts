import { describe, expect, it } from 'vitest'
import { makeRide } from '@/mocks'
import { createRideSchema, rideSchema } from './index'

const validPlace = (lat: number, lng: number) => ({ id: 'p', label: 'Somewhere', coords: { lat, lng } })

const baseInput = {
  origin: validPlace(23.0225, 72.5714),
  destination: validPlace(22.3072, 73.1812),
  departureAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  seatsTotal: 4,
  estimatedCostMinor: 120_000,
  currency: 'INR',
}

describe('createRideSchema — bad input is rejected before business logic (spec §6)', () => {
  it('accepts a well-formed ride', () => {
    expect(createRideSchema.safeParse(baseInput).success).toBe(true)
  })

  it('rejects a departure time in the past', () => {
    const result = createRideSchema.safeParse({ ...baseInput, departureAt: new Date(Date.now() - 1000).toISOString() })
    expect(result.success).toBe(false)
  })

  it('rejects a departure inside the minimum lead time', () => {
    const inFiveMinutes = new Date(Date.now() + 5 * 60_000).toISOString()
    expect(createRideSchema.safeParse({ ...baseInput, departureAt: inFiveMinutes }).success).toBe(false)
  })

  it('rejects a seat count of zero', () => {
    expect(createRideSchema.safeParse({ ...baseInput, seatsTotal: 0 }).success).toBe(false)
  })

  it('rejects an identical origin and destination', () => {
    const result = createRideSchema.safeParse({ ...baseInput, destination: validPlace(23.0225, 72.5714) })
    expect(result.success).toBe(false)
  })

  it('rejects a negative cost', () => {
    expect(createRideSchema.safeParse({ ...baseInput, estimatedCostMinor: -1 }).success).toBe(false)
  })

  it('rejects out-of-range coordinates', () => {
    expect(createRideSchema.safeParse({ ...baseInput, origin: validPlace(91, 0) }).success).toBe(false)
  })
})

describe('rideSchema — contact visibility (§9, spec §3.7)', () => {
  it('parses a ride with no contact details', () => {
    expect(rideSchema.parse(makeRide()).driverContact).toBeNull()
  })

  it('parses a ride that carries contact details once a booking is confirmed', () => {
    const ride = makeRide({ driverContact: { name: 'Dev Driver', phone: '+91 90000 00000' } })
    expect(rideSchema.parse(ride).driverContact?.phone).toBe('+91 90000 00000')
  })

  it('rejects a seat count that has gone negative', () => {
    expect(rideSchema.safeParse(makeRide({ seatsAvailable: -1 })).success).toBe(false)
  })
})

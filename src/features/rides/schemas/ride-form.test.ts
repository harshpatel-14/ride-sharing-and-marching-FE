import { describe, expect, it } from 'vitest'
import { minDepartureLocal, rideFormSchema, toCreateRideInput } from './ride-form'

const localIn = (ms: number) => {
  const d = new Date(Date.now() + ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const valid = {
  origin: { label: 'Iscon Cross Road', coords: { lat: 23.0225, lng: 72.5714 } },
  destination: { label: 'Vadodara Station', coords: { lat: 22.3072, lng: 73.1812 } },
  departureLocal: localIn(3 * 60 * 60 * 1000),
  flexMinutes: 30,
  seatsTotal: 4,
  estimatedCost: '1200',
}

describe('rideFormSchema — bad input caught in the form (spec §6)', () => {
  it('accepts a well-formed ride', () => {
    expect(rideFormSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a departure in the past', () => {
    const result = rideFormSchema.safeParse({ ...valid, departureLocal: localIn(-60 * 60 * 1000) })
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.path.includes('departureLocal'))).toBe(true)
  })

  it('rejects a departure inside the minimum lead time', () => {
    expect(rideFormSchema.safeParse({ ...valid, departureLocal: localIn(5 * 60_000) }).success).toBe(false)
  })

  it('rejects zero seats', () => {
    const result = rideFormSchema.safeParse({ ...valid, seatsTotal: 0 })
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.path.includes('seatsTotal'))).toBe(true)
  })

  it('rejects a fractional seat count', () => {
    expect(rideFormSchema.safeParse({ ...valid, seatsTotal: 2.5 }).success).toBe(false)
  })

  it('rejects an identical origin and destination', () => {
    const result = rideFormSchema.safeParse({
      ...valid,
      destination: { label: 'Same spot', coords: { lat: 23.0225, lng: 72.5714 } },
    })
    expect(result.success).toBe(false)
  })

  it('rejects an out-of-range latitude', () => {
    const result = rideFormSchema.safeParse({
      ...valid,
      origin: { label: 'Nowhere', coords: { lat: 91, lng: 0 } },
    })
    expect(result.success).toBe(false)
  })

  it.each(['', 'twelve hundred', '1200.555', '-5'])('rejects the cost %o', (estimatedCost) => {
    expect(rideFormSchema.safeParse({ ...valid, estimatedCost }).success).toBe(false)
  })
})

describe('toCreateRideInput — form representation becomes wire representation', () => {
  it('converts a local departure time to a UTC instant', () => {
    const parsed = rideFormSchema.parse(valid)
    const input = toCreateRideInput(parsed)
    expect(input.departureAt).toBe(new Date(valid.departureLocal).toISOString())
    expect(input.departureAt).toMatch(/Z$/)
  })

  it('normalises the cost to a two-decimal string', () => {
    const parsed = rideFormSchema.parse({ ...valid, estimatedCost: '1200.5' })
    expect(toCreateRideInput(parsed).estimatedCost).toBe('1200.50')
  })

  /** Money never becomes a number: Number('1200.55') is 1200.5500000000001. */
  it('keeps the amount a string the API can take verbatim', () => {
    const parsed = rideFormSchema.parse({ ...valid, estimatedCost: '1200.55' })
    const input = toCreateRideInput(parsed)
    expect(input.estimatedCost).toBe('1200.55')
    expect(typeof input.estimatedCost).toBe('string')
  })

  it('flattens the nested place fields onto the wire shape', () => {
    const input = toCreateRideInput(rideFormSchema.parse(valid))
    expect(input).toMatchObject({
      originLabel: 'Iscon Cross Road',
      originLat: 23.0225,
      originLng: 72.5714,
      destLabel: 'Vadodara Station',
      destLat: 22.3072,
      destLng: 73.1812,
      flexMinutes: 30,
    })
  })

  it('rejects flexMinutes beyond the API maximum', () => {
    expect(rideFormSchema.safeParse({ ...valid, flexMinutes: 721 }).success).toBe(false)
  })

  it('produces an input the wire schema accepts', async () => {
    const { createRideSchema } = await import('./index')
    const input = toCreateRideInput(rideFormSchema.parse(valid))
    expect(createRideSchema.safeParse(input).success).toBe(true)
  })
})

describe('minDepartureLocal', () => {
  it('is a datetime-local string at least the lead time ahead', () => {
    const value = minDepartureLocal(new Date('2026-09-21T10:00:00'))
    expect(value).toBe('2026-09-21T10:15')
  })
})

import { describe, expect, it } from 'vitest'
import { makeSearchResult } from '@/mocks'
import { parseSearchParams, searchQuerySchema, searchResultSchema, toSearchParams } from './index'

const now = Date.now()
const raw = {
  originLat: '23.0225',
  originLng: '72.5714',
  destLat: '22.3072',
  destLng: '73.1812',
  departAfter: new Date(now).toISOString(),
  departBefore: new Date(now + 4 * 60 * 60 * 1000).toISOString(),
}

describe('searchQuerySchema — one schema, four jobs (§7)', () => {
  it('coerces string URL params into numbers', () => {
    const parsed = searchQuerySchema.parse(raw)
    expect(parsed.originLat).toBe(23.0225)
    expect(typeof parsed.radiusMeters).toBe('number')
  })

  it('applies defaults for radius, seats and limit', () => {
    const parsed = searchQuerySchema.parse(raw)
    expect(parsed).toMatchObject({ radiusMeters: 5_000, seats: 1, limit: 20 })
  })

  it('rejects a time window that ends before it starts', () => {
    const result = searchQuerySchema.safeParse({ ...raw, departBefore: raw.departAfter, departAfter: raw.departBefore })
    expect(result.success).toBe(false)
  })

  it('rejects a radius beyond the API maximum of 50 000 metres', () => {
    expect(searchQuerySchema.safeParse({ ...raw, radiusMeters: '50001' }).success).toBe(false)
    expect(searchQuerySchema.safeParse({ ...raw, radiusMeters: '99' }).success).toBe(false)
  })

  /** The API caps the window at 24 hours; catching it here saves a round trip. */
  it('rejects a time window wider than 24 hours', () => {
    const result = searchQuerySchema.safeParse({
      ...raw,
      departBefore: new Date(now + 25 * 60 * 60 * 1000).toISOString(),
    })
    expect(result.success).toBe(false)
  })

  it('accepts a window of exactly 24 hours', () => {
    const result = searchQuerySchema.safeParse({
      ...raw,
      departBefore: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    })
    expect(result.success).toBe(true)
  })

  it('round-trips through the URL unchanged, so a search is shareable', () => {
    const parsed = searchQuerySchema.parse(raw)
    const reparsed = parseSearchParams(Object.fromEntries(toSearchParams(parsed)))
    expect(reparsed.success).toBe(true)
    expect(reparsed.success && reparsed.data).toEqual(parsed)
  })

  it('reports an invalid URL rather than throwing', () => {
    expect(parseSearchParams({ originLat: 'not-a-number' }).success).toBe(false)
  })
})

describe('search results never carry contact details (§9, spec §3.7)', () => {
  it('parses a driver with no phone or email', () => {
    const parsed = searchResultSchema.parse(makeSearchResult())
    expect(parsed.driver).not.toHaveProperty('phone')
    expect(parsed.driver).not.toHaveProperty('email')
  })

  /**
   * A search result is not a match, so contact details must never survive
   * parsing even if the backend regressed and started sending them.
   */
  it('strips contact details even when the payload wrongly includes them', () => {
    const leaky = {
      ...makeSearchResult(),
      driver: { id: makeSearchResult().driver.id, fullName: 'Leak', phone: '+91 1', email: 'x@y.z' },
    }
    const parsed = searchResultSchema.parse(leaky)
    expect(parsed.driver).not.toHaveProperty('phone')
    expect(parsed.driver).not.toHaveProperty('email')
  })

  it('exposes estimatedShare, which is what the rider would actually pay', () => {
    const parsed = searchResultSchema.parse(makeSearchResult())
    expect(parsed.estimatedShare).toBe('160.00')
    expect(parsed.estimatedCost).toBe('320.00')
  })
})

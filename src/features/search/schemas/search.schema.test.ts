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
    expect(typeof parsed.radiusKm).toBe('number')
  })

  it('applies defaults for radius, seats and limit', () => {
    const parsed = searchQuerySchema.parse(raw)
    expect(parsed).toMatchObject({ radiusKm: 10, seats: 1, limit: 20 })
  })

  it('rejects a time window that ends before it starts', () => {
    const result = searchQuerySchema.safeParse({ ...raw, departBefore: raw.departAfter, departAfter: raw.departBefore })
    expect(result.success).toBe(false)
  })

  it('rejects a radius beyond the supported maximum', () => {
    expect(searchQuerySchema.safeParse({ ...raw, radiusKm: '500' }).success).toBe(false)
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
  it('has no driverContact property on the parsed result', () => {
    const parsed = searchResultSchema.parse(makeSearchResult())
    expect(parsed).not.toHaveProperty('driverContact')
  })

  it('strips driverContact even when the backend wrongly includes it', () => {
    const leaky = { ...makeSearchResult(), driverContact: { name: 'Leak', phone: '+91 1' } }
    expect(searchResultSchema.parse(leaky)).not.toHaveProperty('driverContact')
  })
})

import { describe, expect, it } from 'vitest'
import {
  defaultSearchFormValues,
  fromSearchQuery,
  searchFormSchema,
  toSearchQuery,
} from './search-form'
import { searchQuerySchema } from './index'

const pad = (n: number) => String(n).padStart(2, '0')
const local = (offsetMs: number) => {
  const d = new Date(Date.now() + offsetMs)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const valid = {
  origin: { label: 'Prahlad Nagar', coords: { lat: 23.0103, lng: 72.5074 } },
  destination: { label: 'Vastrapur', coords: { lat: 23.0364, lng: 72.529 } },
  departAfterLocal: local(0),
  departBeforeLocal: local(4 * 3_600_000),
  radiusMeters: 5_000,
  seats: 1,
}

describe('searchFormSchema', () => {
  it('accepts a well-formed search', () => {
    expect(searchFormSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a window that ends before it starts', () => {
    const result = searchFormSchema.safeParse({
      ...valid,
      departAfterLocal: local(4 * 3_600_000),
      departBeforeLocal: local(0),
    })
    expect(result.success).toBe(false)
  })

  /** The API caps the window at 24 hours; catching it here saves a round trip. */
  it('rejects a window wider than 24 hours', () => {
    const result = searchFormSchema.safeParse({
      ...valid,
      departBeforeLocal: local(25 * 3_600_000),
    })
    expect(result.success).toBe(false)
  })

  it('rejects a radius outside the API range', () => {
    expect(searchFormSchema.safeParse({ ...valid, radiusMeters: 99 }).success).toBe(false)
    expect(searchFormSchema.safeParse({ ...valid, radiusMeters: 50_001 }).success).toBe(false)
  })

  it('rejects an identical origin and destination', () => {
    const result = searchFormSchema.safeParse({
      ...valid,
      destination: { label: 'Same', coords: { lat: 23.0103, lng: 72.5074 } },
    })
    expect(result.success).toBe(false)
  })
})

describe('toSearchQuery — form representation becomes wire representation', () => {
  it('converts local times to UTC instants', () => {
    const query = toSearchQuery(searchFormSchema.parse(valid))
    expect(query.departAfter).toMatch(/Z$/)
    expect(query.departBefore).toMatch(/Z$/)
  })

  it('emits metres, which is what the API speaks', () => {
    const query = toSearchQuery(searchFormSchema.parse(valid))
    expect(query.radiusMeters).toBe(5_000)
    expect(query).not.toHaveProperty('radiusKm')
  })

  it('produces something the wire schema accepts', () => {
    const query = toSearchQuery(searchFormSchema.parse(valid))
    expect(searchQuerySchema.safeParse(query).success).toBe(true)
  })

  /** A shared search link must reproduce the same screen. (§7) */
  it('round-trips through the URL form and back', () => {
    const query = toSearchQuery(searchFormSchema.parse(valid))
    const repopulated = fromSearchQuery(query)
    const reparsed = searchFormSchema.parse({
      ...repopulated,
      origin: { ...repopulated.origin, label: 'x' },
      destination: { ...repopulated.destination, label: 'y' },
    })
    expect(toSearchQuery(reparsed)).toEqual(query)
  })
})

describe('defaultSearchFormValues', () => {
  it('opens on a valid four-hour window', () => {
    const values = defaultSearchFormValues(new Date('2026-09-21T10:00:00'))
    expect(values.departAfterLocal).toBe('2026-09-21T10:00')
    expect(values.departBeforeLocal).toBe('2026-09-21T14:00')
  })
})

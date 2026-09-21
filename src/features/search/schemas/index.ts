import { z } from 'zod'
import { SEARCH, RIDE } from '@/config/constants'
import { publicDriverSchema, placeSchema, rideStatusSchema } from '@/features/rides'
import { decimalStringSchema } from '@/lib/utils'

/**
 * Search query. (§7)
 *
 * One schema does four jobs: validates the form, parses `searchParams` in the
 * RSC, serialises back to a query string, and types the API call.
 *
 * `z.coerce` matters because URL params are always strings. Note the API
 * speaks METRES, not kilometres.
 */
export const searchQuerySchema = z
  .object({
    originLat: z.coerce.number().min(-90).max(90),
    originLng: z.coerce.number().min(-180).max(180),
    destLat: z.coerce.number().min(-90).max(90),
    destLng: z.coerce.number().min(-180).max(180),

    /** Proximity AND time overlap together — never either alone. (spec §3.2) */
    departAfter: z.iso.datetime(),
    departBefore: z.iso.datetime(),

    radiusMeters: z.coerce
      .number()
      .int()
      .min(SEARCH.MIN_RADIUS_METERS)
      .max(SEARCH.MAX_RADIUS_METERS)
      .default(SEARCH.DEFAULT_RADIUS_METERS),
    seats: z.coerce.number().int().min(RIDE.MIN_SEATS).max(RIDE.MAX_SEATS).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((v) => new Date(v.departAfter) < new Date(v.departBefore), {
    message: 'Time window must start before it ends',
    path: ['departBefore'],
  })
  // The API rejects anything wider; catching it here saves a round trip.
  .refine(
    (v) =>
      new Date(v.departBefore).getTime() - new Date(v.departAfter).getTime() <=
      SEARCH.MAX_WINDOW_HOURS * 3_600_000,
    {
      message: `The time window may not exceed ${SEARCH.MAX_WINDOW_HOURS} hours`,
      path: ['departBefore'],
    },
  )

export type SearchQuery = z.infer<typeof searchQuerySchema>
export type SearchQueryInput = z.input<typeof searchQuerySchema>

/**
 * A search result is NOT a full ride. (§9, docs/API.md)
 *
 * `driver` is always the public shape — a search result is not a match, so
 * there is never contact information to leak. It also carries server-computed
 * match metadata and `estimatedShare`, which is what to display instead of
 * `estimatedCost`.
 */
export const searchResultSchema = z.object({
  id: z.uuid(),
  origin: placeSchema,
  destination: placeSchema,
  departureAt: z.iso.datetime(),
  flexMinutes: z.number().int().min(0),
  seatsTotal: z.number().int(),
  seatsAvailable: z.number().int().min(0),
  estimatedCost: decimalStringSchema,
  /** What THIS rider would pay if they joined. Show this, not estimatedCost. */
  estimatedShare: decimalStringSchema,
  status: rideStatusSchema,
  driver: publicDriverSchema,
  /** Distance from the requested points — for labelling, never for filtering. */
  originMeters: z.number().min(0),
  destMeters: z.number().min(0),
})
export type SearchResult = z.infer<typeof searchResultSchema>

/** Ranked top-N: there is no cursor. */
export const searchResponseSchema = z.object({
  rides: z.array(searchResultSchema),
  searchedAt: z.iso.datetime(),
})
export type SearchResponse = z.infer<typeof searchResponseSchema>

/** Serialise back to URL params so a search is shareable. (§7) */
export function toSearchParams(query: SearchQuery): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value))
  }
  return params
}

/** Parse `searchParams` in an RSC. */
export function parseSearchParams(input: Record<string, string | string[] | undefined>) {
  const flat = Object.fromEntries(
    Object.entries(input).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  )
  return searchQuerySchema.safeParse(flat)
}

import { z } from 'zod'
import { SEARCH, RIDE } from '@/config/constants'
import { rideSchema } from '@/features/rides'

/**
 * Search query. (§7)
 *
 * This ONE schema does four jobs: validates the form, parses `searchParams` in
 * the RSC, serialises back to a query string, and types the API call. That is
 * what "one source of truth" actually buys.
 *
 * `z.coerce` matters because URL params are always strings.
 */
export const searchQuerySchema = z
  .object({
    originLat: z.coerce.number().min(-90).max(90),
    originLng: z.coerce.number().min(-180).max(180),
    destLat: z.coerce.number().min(-90).max(90),
    destLng: z.coerce.number().min(-180).max(180),

    /** Time window. Proximity AND overlap together — never either alone. (spec §3.2) */
    departAfter: z.iso.datetime(),
    departBefore: z.iso.datetime(),

    radiusKm: z.coerce
      .number()
      .min(SEARCH.MIN_RADIUS_KM)
      .max(SEARCH.MAX_RADIUS_KM)
      .default(SEARCH.DEFAULT_RADIUS_KM),
    seats: z.coerce.number().int().min(RIDE.MIN_SEATS).max(RIDE.MAX_SEATS).default(1),

    /** Cursor, not offset: open rides change under you as people book. (§7) */
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(SEARCH.PAGE_SIZE),
  })
  .refine((v) => new Date(v.departAfter) < new Date(v.departBefore), {
    message: 'Time window must start before it ends',
    path: ['departBefore'],
  })

export type SearchQuery = z.infer<typeof searchQuerySchema>
export type SearchQueryInput = z.input<typeof searchQuerySchema>

/**
 * A search result is a ride WITHOUT contact details, plus server-computed
 * match metadata. `driverContact` is omitted at the type level: search happens
 * before any booking exists, so there is nothing to reveal. (§9)
 */
export const searchResultSchema = rideSchema.omit({ driverContact: true }).extend({
  /** Computed by the server's matching query — for labelling, not filtering. */
  originDistanceKm: z.number().min(0),
  destinationDistanceKm: z.number().min(0),
})
export type SearchResult = z.infer<typeof searchResultSchema>

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  nextCursor: z.string().nullable(),
})
export type SearchResponse = z.infer<typeof searchResponseSchema>

/** Serialise a query back to URL params so a search is shareable. (§7) */
export function toSearchParams(query: SearchQuery): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value))
  }
  return params
}

/** Parse `searchParams` in an RSC. Returns null when the URL has no valid search. */
export function parseSearchParams(input: Record<string, string | string[] | undefined>) {
  const flat = Object.fromEntries(
    Object.entries(input).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  )
  return searchQuerySchema.safeParse(flat)
}

import { createNominatimProvider } from './nominatim'
import type { GeoProvider } from './types'

export type { LatLng, Place, BoundingBox, GeoProvider } from './types'
export { latLngSchema, placeSchema, type LatLngInput, type PlaceInput } from './schemas'
export { haversineKm } from './haversine'
export { createNominatimProvider } from './nominatim'

let cached: GeoProvider | null | undefined

/**
 * The configured geocoder, or null when none is set. (§8)
 *
 * Returning null rather than throwing is deliberate: a missing geocoder
 * degrades the place picker to manual coordinate entry, which is unglamorous
 * but keeps the app usable. Coordinates are what the matching query needs;
 * the label is only ever for display.
 */
export function getGeoProvider(): GeoProvider | null {
  if (cached !== undefined) return cached
  const baseUrl = process.env.NEXT_PUBLIC_GEOCODER_URL
  cached = baseUrl ? createNominatimProvider(baseUrl) : null
  return cached
}

/** Metres are the API's unit; kilometres are the human one. */
export const metersToKm = (meters: number): number => meters / 1000

export function formatDistance(meters: number): string {
  // Truncated rather than rounded: the project bans Math.round as a tripwire
  // for money bugs, and 10-metre precision on a walking distance does not
  // justify an exception.
  if (meters < 950) return `${Math.trunc(meters / 10) * 10} m`
  return `${(meters / 1000).toFixed(1)} km`
}

import type { GeoProvider, LatLng, Place } from './types'
import { haversineKm } from './haversine'

/**
 * Geocoding over a Nominatim-compatible endpoint. (§8)
 *
 * The API does not geocode — docs/FRONTEND.md is explicit that wiring a place
 * picker is the client's job. This is one implementation of the provider
 * interface, not a commitment: swapping to MapTiler, Mapbox or Google is a
 * new file in this directory and one line in `index.ts`.
 *
 * Opt-in via NEXT_PUBLIC_GEOCODER_URL. Public Nominatim has a strict usage
 * policy (1 req/s, identifying User-Agent) which a browser cannot honour
 * reliably, so leaving it unset is the safe default and the UI falls back to
 * manual coordinate entry.
 */
export function createNominatimProvider(baseUrl: string): GeoProvider {
  const search = async (query: string, near?: LatLng, signal?: AbortSignal): Promise<Place[]> => {
    const trimmed = query.trim()
    if (trimmed.length < 3) return []

    const url = new URL(`${baseUrl.replace(/\/$/, '')}/search`)
    url.searchParams.set('q', trimmed)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '6')
    url.searchParams.set('addressdetails', '0')
    if (near) {
      // Bias results towards the map viewport without hard-filtering them.
      url.searchParams.set('viewbox', viewboxAround(near))
    }

    const response = await fetch(url, { signal: signal ?? null, headers: { Accept: 'application/json' } })
    if (!response.ok) return []

    const rows = (await response.json()) as Array<{
      place_id?: number | string
      display_name?: string
      lat?: string
      lon?: string
    }>

    return rows.flatMap((row) => {
      const lat = Number(row.lat)
      const lng = Number(row.lon)
      if (!row.display_name || Number.isNaN(lat) || Number.isNaN(lng)) return []
      return [{ id: String(row.place_id ?? `${lat},${lng}`), label: row.display_name, coords: { lat, lng } }]
    })
  }

  const reverse = async (coords: LatLng, signal?: AbortSignal): Promise<Place | null> => {
    const url = new URL(`${baseUrl.replace(/\/$/, '')}/reverse`)
    url.searchParams.set('lat', String(coords.lat))
    url.searchParams.set('lon', String(coords.lng))
    url.searchParams.set('format', 'jsonv2')

    const response = await fetch(url, { signal: signal ?? null, headers: { Accept: 'application/json' } })
    if (!response.ok) return null

    const row = (await response.json()) as { place_id?: number | string; display_name?: string }
    if (!row.display_name) return null
    return { id: String(row.place_id ?? 'reverse'), label: row.display_name, coords }
  }

  return { search, reverse, distanceKm: haversineKm }
}

/** Roughly a 50km box, enough to bias without excluding. */
function viewboxAround({ lat, lng }: LatLng): string {
  const d = 0.25
  return `${lng - d},${lat + d},${lng + d},${lat - d}`
}

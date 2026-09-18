/**
 * Provider-neutral AND backend-neutral geo types. (§8)
 *
 * The backend may represent a point as PostGIS geography(Point) with a GiST
 * index, or as a lat/lng pair with a bounding-box prefilter. The frontend must
 * not encode that choice — everything above this file speaks LatLng and Place.
 */

export interface LatLng {
  lat: number
  lng: number
}

export interface Place {
  /** Provider-specific id. Opaque to everything outside lib/geo. */
  id: string
  /** Human-readable, e.g. "Iscon Cross Road, Ahmedabad". */
  label: string
  coords: LatLng
}

export interface BoundingBox {
  south: number
  west: number
  north: number
  east: number
}

export interface GeoProvider {
  search(query: string, near?: LatLng, signal?: AbortSignal): Promise<Place[]>
  reverse(coords: LatLng, signal?: AbortSignal): Promise<Place | null>
  /**
   * Display labelling ONLY ("2.1 km from your pickup"). This must never gate
   * what appears in a result list — that is the server's matching query. (§7)
   */
  distanceKm(a: LatLng, b: LatLng): number
}

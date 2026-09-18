import type { LatLng } from './types'

const EARTH_RADIUS_KM = 6371

/**
 * Great-circle distance, for DISPLAY LABELS ONLY. (§7, §8)
 *
 * If you find yourself calling this to decide whether a ride should appear in
 * a result list, stop: matching is a real indexed database query (spec §3.2),
 * and duplicating it here would both lie to the user across page boundaries
 * and undermine the whole point of the exercise.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

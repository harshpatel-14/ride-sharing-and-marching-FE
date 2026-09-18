/** Tunables. Centralised so a change is one diff, not a grep. */

export const SEARCH = {
  DEFAULT_RADIUS_KM: 10,
  MIN_RADIUS_KM: 1,
  MAX_RADIUS_KM: 50,
  PAGE_SIZE: 20,
  /** Virtualise the result list past this many rows. (§14) */
  VIRTUALIZE_THRESHOLD: 50,
  GEOCODER_DEBOUNCE_MS: 300,
} as const

export const RIDE = {
  MIN_SEATS: 1,
  MAX_SEATS: 8,
  /** A ride must depart at least this far in the future. (spec §6) */
  MIN_LEAD_TIME_MINUTES: 15,
} as const

/**
 * Seat-count freshness. Polling first — one line and honest. Swap the transport
 * behind useRideLiveSeats() when SSE lands; call sites don't change. (§6.3)
 */
export const LIVE = {
  RIDE_DETAIL_POLL_MS: 5_000,
  SEARCH_RESULTS_STALE_MS: 30_000,
} as const

export const QUERY = {
  DEFAULT_STALE_MS: 30_000,
  DEFAULT_GC_MS: 5 * 60_000,
} as const

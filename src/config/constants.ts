/** Tunables. Centralised so a change is one diff, not a grep. */

export const SEARCH = {
  /** The API speaks metres, 100–50 000, default 5 000. */
  DEFAULT_RADIUS_METERS: 5_000,
  MIN_RADIUS_METERS: 100,
  MAX_RADIUS_METERS: 50_000,
  /** The API caps the search window at 24 hours. */
  MAX_WINDOW_HOURS: 24,
  PAGE_SIZE: 20,
  /** Virtualise the result list past this many rows. (§14) */
  VIRTUALIZE_THRESHOLD: 50,
  GEOCODER_DEBOUNCE_MS: 300,
} as const

export const RIDE = {
  MIN_SEATS: 1,
  MAX_SEATS: 8,
  /**
   * The API requires only "in the future". This client-side floor is a little
   * stricter so a rider is not shown a ride that departs before they could
   * plausibly reach it, and so a slow submit cannot fail validation between
   * typing and sending.
   */
  MIN_LEAD_TIME_MINUTES: 15,
  /** `flexMinutes` range accepted by the API. */
  MAX_FLEX_MINUTES: 720,
  DEFAULT_FLEX_MINUTES: 30,
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

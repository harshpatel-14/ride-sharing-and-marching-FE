/**
 * Query key registry. (§5.2)
 *
 * Every cache key is constructed here. The reason is invalidation: booking a
 * seat must invalidate the ride, any cached search results, and the rider's
 * bookings — and an invalidation that misses one reproduces exactly the
 * problem this product exists to fix, a seat that looks available but isn't.
 */
export const queryKeys = {
  session: ['session'] as const,

  rides: {
    all: ['rides'] as const,
    detail: (rideId: string) => ['rides', 'detail', rideId] as const,
    mine: () => ['rides', 'mine'] as const,
    /** The driver's manifest of bookings on their ride. */
    manifest: (rideId: string) => ['rides', rideId, 'bookings'] as const,
    audit: (rideId: string) => ['rides', rideId, 'audit'] as const,
  },

  search: {
    all: ['search'] as const,
    results: (query: unknown) => ['search', 'results', query] as const,
  },

  bookings: {
    all: ['bookings'] as const,
    mine: () => ['bookings', 'mine'] as const,
    detail: (bookingId: string) => ['bookings', 'detail', bookingId] as const,
  },
} as const

export type QueryKey = readonly unknown[]

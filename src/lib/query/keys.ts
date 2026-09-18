/**
 * Query key registry. (§5.2)
 *
 * Every cache key in the app is constructed here. The reason is invalidation:
 * booking a seat must invalidate the ride, the search results, and the rider's
 * bookings, and an invalidation that misses one of those reproduces exactly the
 * problem this product exists to fix — a seat that looks available but isn't.
 */

export const queryKeys = {
  session: ['session'] as const,

  rides: {
    all: ['rides'] as const,
    detail: (rideId: string) => ['rides', 'detail', rideId] as const,
    mine: () => ['rides', 'mine'] as const,
    bookings: (rideId: string) => ['rides', rideId, 'bookings'] as const,
    costSplit: (rideId: string) => ['rides', rideId, 'cost-split'] as const,
  },

  search: {
    all: ['search'] as const,
    /** Key includes the full query object so each distinct search caches separately. */
    results: (query: unknown) => ['search', 'results', query] as const,
  },

  bookings: {
    all: ['bookings'] as const,
    mine: () => ['bookings', 'mine'] as const,
    detail: (bookingId: string) => ['bookings', 'detail', bookingId] as const,
  },
} as const

export type QueryKey = readonly unknown[]

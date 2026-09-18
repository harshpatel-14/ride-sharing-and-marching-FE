/**
 * Every API path the frontend knows about. One file to grep, one file to diff
 * against the backend router.
 *
 * Note what is NOT here: there is no "list all rides" endpoint. Matching is a
 * real database query (spec §3.2) and the frontend has no way to fetch the
 * corpus and filter it client-side even if someone wanted to. That absence is
 * a structural guarantee, not an oversight. (§17)
 */
export const endpoints = {
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    me: '/auth/me',
  },

  rides: {
    create: '/rides',
    byId: (rideId: string) => `/rides/${rideId}`,
    mine: '/rides/mine',
    cancel: (rideId: string) => `/rides/${rideId}/cancel`,
    complete: (rideId: string) => `/rides/${rideId}/complete`,
    bookings: (rideId: string) => `/rides/${rideId}/bookings`,
    costSplit: (rideId: string) => `/rides/${rideId}/cost-split`,
  },

  /** Proximity + time-window matching. Server-side query, always. */
  search: {
    rides: '/search/rides',
  },

  bookings: {
    create: (rideId: string) => `/rides/${rideId}/bookings`,
    mine: '/bookings/mine',
    byId: (bookingId: string) => `/bookings/${bookingId}`,
    cancel: (bookingId: string) => `/bookings/${bookingId}/cancel`,
  },
} as const

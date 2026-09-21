/**
 * Every API path the frontend knows about, relative to the versioned base
 * (`/api/v1` on the server, `/api/proxy` through the BFF in the browser).
 *
 * Note what is NOT here: there is no "list all rides" endpoint. Matching is a
 * real indexed query (spec §3.2) and the frontend has no corpus to filter
 * client-side even if someone wanted to. That absence is structural. (§17)
 */
export const endpoints = {
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    logoutAll: '/auth/logout-all',
  },

  me: {
    profile: '/me',
    rides: '/me/rides',
    bookings: '/me/bookings',
  },

  rides: {
    create: '/rides',
    /** Must precede `/rides/:id` in any router — it is not a UUID. */
    search: '/rides/search',
    byId: (rideId: string) => `/rides/${rideId}`,
    cancel: (rideId: string) => `/rides/${rideId}/cancel`,
    complete: (rideId: string) => `/rides/${rideId}/complete`,
    bookings: (rideId: string) => `/rides/${rideId}/bookings`,
    audit: (rideId: string) => `/rides/${rideId}/audit`,
  },

  bookings: {
    create: (rideId: string) => `/rides/${rideId}/bookings`,
    cancel: (bookingId: string) => `/bookings/${bookingId}/cancel`,
  },
} as const

/** Path prefix the BFF proxy mounts at, in the browser. */
export const BFF_PROXY_BASE = '/api/proxy'

/** Versioned prefix on the Express service itself. */
export const API_VERSION_PREFIX = '/api/v1'

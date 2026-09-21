import { http, HttpResponse } from 'msw'
import {
  IDS,
  makeBooking,
  makeBookingWithRide,
  makeDriverCancelledBooking,
  makeRide,
  makeSearchResult,
  makeUser,
} from './factories'

/**
 * Default happy-path handlers, matching the envelopes in docs/API.md.
 *
 * Client code talks to the BFF (`/api/auth/*`, `/api/proxy/*`), so these
 * intercept both that and the upstream shape, letting the same handlers serve
 * component tests and the browser dev runtime.
 */

type Json = Parameters<typeof HttpResponse.json>[0]
const ok = (body: Json, status = 200) => HttpResponse.json(body, { status })

/** The backend's error envelope. */
export const apiError = (code: string, message: string, status: number, details?: unknown) =>
  HttpResponse.json(
    { error: { code, message, ...(details ? { details } : {}) }, requestId: 'test-request-id' },
    { status },
  )

export const handlers = [
  // ── BFF auth ───────────────────────────────────────────────────────────
  http.get('*/api/auth/me', () => ok({ user: makeUser() })),
  http.post('*/api/auth/login', () => ok({ user: makeUser() })),
  http.post('*/api/auth/register', () => ok({ user: makeUser() }, 201)),
  http.post('*/api/auth/logout', () => ok({ ok: true })),

  // ── upstream auth (used by BFF route-handler tests) ────────────────────
  http.post('*/auth/login', () =>
    ok({
      user: makeUser(),
      tokens: { accessToken: 'access.jwt.token', refreshToken: 'refresh-token', tokenType: 'Bearer', expiresIn: 900 },
    }),
  ),
  http.post('*/auth/refresh', () =>
    ok({
      user: makeUser(),
      tokens: { accessToken: 'refreshed.jwt.token', refreshToken: 'rotated-refresh-token', tokenType: 'Bearer', expiresIn: 900 },
    }),
  ),
  http.get('*/me', () => ok({ user: makeUser() })),

  // ── rides ──────────────────────────────────────────────────────────────
  http.get('*/me/rides', () => ok({ rides: [makeRide({ isOwner: true })], nextCursor: null })),
  http.post('*/rides', () => ok({ ride: makeRide({ isOwner: true }) }, 201)),
  http.get('*/rides/search', () => ok({ rides: [makeSearchResult()], searchedAt: new Date().toISOString() })),
  http.get('*/rides/:rideId', ({ params }) => ok({ ride: makeRide({ id: String(params['rideId']) }) })),
  http.patch('*/rides/:rideId', ({ params }) => ok({ ride: makeRide({ id: String(params['rideId']), isOwner: true }) })),
  http.post('*/rides/:rideId/cancel', ({ params }) =>
    ok({
      ride: makeRide({
        id: String(params['rideId']),
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        isOwner: true,
      }),
      bookingsCancelled: 1,
    }),
  ),
  http.post('*/rides/:rideId/complete', ({ params }) =>
    ok({
      ride: makeRide({
        id: String(params['rideId']),
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        isOwner: true,
      }),
    }),
  ),

  // ── bookings ───────────────────────────────────────────────────────────
  http.post('*/rides/:rideId/bookings', ({ params }) =>
    ok({ booking: makeBooking({ rideId: String(params['rideId']) }) }, 201),
  ),
  http.get('*/rides/:rideId/bookings', () => ok({ bookings: [makeBooking()] })),
  http.get('*/me/bookings', () => ok({ bookings: [makeBookingWithRide()], nextCursor: null })),
  http.post('*/bookings/:bookingId/cancel', ({ params }) =>
    ok({
      booking: makeBooking({
        id: String(params['bookingId']),
        status: 'CANCELLED_BY_RIDER',
        amountOwed: '0.00',
        cancelledAt: new Date().toISOString(),
        cancellationReason: 'Plans changed',
      }),
      seatsAvailable: 3,
    }),
  ),
]

/**
 * Named error scenarios. Import these rather than hand-rolling a 409 per test,
 * so the envelope shape lives in one place.
 */
export const scenarios = {
  /** The last-seat race. spec §3.3 — the sharpest requirement in the POC. */
  seatTaken: () =>
    http.post('*/rides/:rideId/bookings', () =>
      apiError('NO_SEATS_AVAILABLE', 'No seats remaining on this ride', 409),
    ),

  alreadyBooked: () =>
    http.post('*/rides/:rideId/bookings', () =>
      apiError('ALREADY_BOOKED', 'You already hold a seat on this ride', 409),
    ),

  cannotBookOwnRide: () =>
    http.post('*/rides/:rideId/bookings', () =>
      apiError('CANNOT_BOOK_OWN_RIDE', 'You cannot book a seat on a ride you are driving', 422),
    ),

  rideCompleted: (method: 'cancel' | 'complete' | 'book' = 'book') => {
    const path =
      method === 'book' ? '*/rides/:rideId/bookings' : `*/rides/:rideId/${method}`
    return http.post(path, () =>
      apiError('RIDE_COMPLETED_IMMUTABLE', 'This ride is completed and can no longer be booked', 409),
    )
  },

  rideCancelled: () =>
    http.post('*/rides/:rideId/bookings', () => apiError('RIDE_NOT_OPEN', 'This ride was cancelled', 409)),

  /** Not found AND not-yours are the same response, deliberately. */
  rideNotFound: () =>
    http.get('*/rides/:rideId', () => apiError('RIDE_NOT_FOUND', 'Ride not found', 404)),

  invalidCredentials: () =>
    http.post('*/api/auth/login', () =>
      apiError('INVALID_CREDENTIALS', 'Email or password is incorrect', 401),
    ),

  emailTaken: () =>
    http.post('*/api/auth/register', () =>
      apiError('EMAIL_ALREADY_REGISTERED', 'That email is already registered', 409),
    ),

  unauthenticated: () =>
    http.get('*/api/auth/me', () => apiError('UNAUTHENTICATED', 'Not signed in', 401)),

  tokenExpired: (path: string) =>
    http.get(`*${path}`, () => apiError('TOKEN_EXPIRED', 'Access token has expired', 401)),

  rateLimited: (path: string) =>
    http.post(`*${path}`, () => apiError('RATE_LIMITED', 'Too many attempts', 429)),

  validationFailed: (path: string, field: string, message: string) =>
    http.post(`*${path}`, () =>
      apiError('VALIDATION_FAILED', 'Request validation failed', 400, [
        { source: 'body', field, code: 'too_small', message },
      ]),
    ),

  networkFailure: (path: string) => http.post(`*${path}`, () => HttpResponse.error()),
} as const

export { makeDriverCancelledBooking, IDS }

import { http, HttpResponse } from 'msw'
import { endpoints } from '@/lib/api'
import {
  makeBookingWithRide,
  makeCostSplit,
  makeRide,
  makeSearchResult,
  makeSession,
} from './factories'

const API = '*'

/**
 * Default happy-path handlers. Individual tests override with `server.use(...)`
 * to produce the interesting cases — 409 on the last seat above all. (§12)
 */
export const handlers = [
  // ── auth (via the BFF) ─────────────────────────────────────────────────
  http.get('*/api/auth/me', () => HttpResponse.json(makeSession())),
  http.post('*/api/auth/login', () => HttpResponse.json(makeSession())),
  http.post('*/api/auth/register', () => HttpResponse.json(makeSession(), { status: 201 })),
  http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })),

  // ── rides ──────────────────────────────────────────────────────────────
  http.get(`${API}${endpoints.rides.mine}`, () => HttpResponse.json([makeRide()])),
  http.post(`${API}${endpoints.rides.create}`, () => HttpResponse.json(makeRide(), { status: 201 })),
  http.get(`${API}/rides/:rideId`, ({ params }) =>
    HttpResponse.json(makeRide({ id: String(params['rideId']) })),
  ),
  http.post(`${API}/rides/:rideId/cancel`, ({ params }) =>
    HttpResponse.json(makeRide({ id: String(params['rideId']), status: 'CANCELLED', seatsAvailable: 0 })),
  ),
  http.post(`${API}/rides/:rideId/complete`, ({ params }) =>
    HttpResponse.json(makeRide({ id: String(params['rideId']), status: 'COMPLETED' })),
  ),
  http.get(`${API}/rides/:rideId/cost-split`, ({ params }) =>
    HttpResponse.json(makeCostSplit({ rideId: String(params['rideId']) })),
  ),

  // ── search ─────────────────────────────────────────────────────────────
  http.get(`${API}${endpoints.search.rides}`, () =>
    HttpResponse.json({ results: [makeSearchResult()], nextCursor: null }),
  ),

  // ── bookings ───────────────────────────────────────────────────────────
  http.post(`${API}/rides/:rideId/bookings`, ({ params }) =>
    HttpResponse.json(makeBookingWithRide({ rideId: String(params['rideId']) }), { status: 201 }),
  ),
  http.get(`${API}${endpoints.bookings.mine}`, () => HttpResponse.json([makeBookingWithRide()])),
  http.get(`${API}/bookings/:bookingId`, ({ params }) =>
    HttpResponse.json(makeBookingWithRide({ id: String(params['bookingId']) })),
  ),
  http.post(`${API}/bookings/:bookingId/cancel`, ({ params }) =>
    HttpResponse.json(
      makeBookingWithRide({
        id: String(params['bookingId']),
        status: 'CANCELLED_BY_RIDER',
        contact: null,
        cancelledAt: new Date().toISOString(),
      }),
    ),
  ),
]

/**
 * Named error scenarios. Import these rather than hand-rolling a 409 in each
 * test — one definition means one place to update when the backend's error
 * body shape changes.
 */
export const scenarios = {
  /** The last-seat race. spec §3.3 — the sharpest requirement in the POC. */
  seatTaken: () =>
    http.post(`${API}/rides/:rideId/bookings`, () =>
      HttpResponse.json(
        { code: 'SEAT_UNAVAILABLE', message: 'No seats remaining' },
        { status: 409 },
      ),
    ),

  alreadyBooked: () =>
    http.post(`${API}/rides/:rideId/bookings`, () =>
      HttpResponse.json({ code: 'ALREADY_BOOKED', message: 'You already hold a seat' }, { status: 409 }),
    ),

  rideCompleted: () =>
    http.post(`${API}/rides/:rideId/bookings`, () =>
      HttpResponse.json({ code: 'RIDE_COMPLETED', message: 'Ride is completed' }, { status: 410 }),
    ),

  /** Someone else's booking, reached directly by ID. spec §6 */
  forbidden: (path: string) =>
    http.post(`${API}${path}`, () =>
      HttpResponse.json({ code: 'FORBIDDEN', message: 'Not yours' }, { status: 403 }),
    ),

  unauthenticated: () =>
    http.get('*/api/auth/me', () =>
      HttpResponse.json({ code: 'UNAUTHENTICATED', message: 'No session' }, { status: 401 }),
    ),

  networkFailure: (path: string) => http.post(`${API}${path}`, () => HttpResponse.error()),
} as const

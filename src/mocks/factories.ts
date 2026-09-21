import type { User } from '@/features/auth'
import type { Driver, Ride, RideStatus } from '@/features/rides'
import type { Booking, BookingStatus } from '@/features/bookings'
import type { SearchResult } from '@/features/search'

/**
 * Fixtures shaped from the real payloads in docs/API.md.
 *
 * Each factory's return type is the Zod-inferred domain type, so the day a
 * schema gains a required field every factory fails to compile. That is the
 * point: mocks that drift from the contract give a green suite testing an API
 * that no longer exists. (§12)
 */

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()

export const IDS = {
  driver: uuid(2),
  rider: uuid(9),
  ride: uuid(100),
  completedRide: uuid(199),
  booking: uuid(200),
} as const

export function resetFactories() {
  /* Ids are deterministic, so there is no counter to reset. Kept as a hook
     for when a factory needs sequencing. */
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: IDS.driver,
    email: 'asha@example.com',
    fullName: 'Asha M. Mehta',
    phone: '+91 98111 00001',
    createdAt: iso(-86_400_000),
    ...overrides,
  }
}

/** The public driver shape — no contact details. The default. */
export function makePublicDriver(overrides: Partial<Driver> = {}): Driver {
  return { id: IDS.driver, fullName: 'Asha M. Mehta', ...overrides }
}

/** Only ever returned to the driver themselves or a confirmed rider. (§9) */
export function makeDriverWithContact(): Driver {
  return {
    id: IDS.driver,
    fullName: 'Asha M. Mehta',
    phone: '+91 98111 00001',
    email: 'asha@example.com',
  }
}

export function makeRide(overrides: Partial<Ride> = {}): Ride {
  const departureAt = overrides.departureAt ?? iso(6 * 3_600_000)
  const flexMinutes = overrides.flexMinutes ?? 30
  const flexMs = flexMinutes * 60_000

  return {
    id: IDS.ride,
    origin: { label: 'Prahlad Nagar', lat: 23.0103, lng: 72.5074 },
    destination: { label: 'Vastrapur', lat: 23.0364, lng: 72.529 },
    departureAt,
    flexMinutes,
    departureWindow: {
      from: new Date(new Date(departureAt).getTime() - flexMs).toISOString(),
      to: new Date(new Date(departureAt).getTime() + flexMs).toISOString(),
    },
    seatsTotal: 3,
    seatsTaken: 0,
    seatsAvailable: 3,
    estimatedCost: '300.00',
    status: 'OPEN' satisfies RideStatus,
    createdAt: iso(-3_600_000),
    completedAt: null,
    cancelledAt: null,
    // Public by default: contact details are the exception, not the norm.
    driver: makePublicDriver(),
    isOwner: false,
    ...overrides,
  }
}

/** One seat left — the setup for every last-seat test. */
export function makeLastSeatRide(overrides: Partial<Ride> = {}): Ride {
  return makeRide({ seatsTotal: 3, seatsTaken: 2, seatsAvailable: 1, ...overrides })
}

export function makeSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  const ride = makeRide()
  return {
    id: ride.id,
    origin: ride.origin,
    destination: ride.destination,
    departureAt: ride.departureAt,
    flexMinutes: ride.flexMinutes,
    seatsTotal: ride.seatsTotal,
    seatsAvailable: ride.seatsAvailable,
    estimatedCost: '320.00',
    // What this rider would pay if they joined — show this, not estimatedCost.
    estimatedShare: '160.00',
    status: 'OPEN',
    driver: { id: IDS.driver, fullName: 'Asha M. Mehta' },
    originMeters: 0,
    destMeters: 0,
    ...overrides,
  }
}

export function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: IDS.booking,
    rideId: IDS.ride,
    riderId: IDS.rider,
    status: 'CONFIRMED' satisfies BookingStatus,
    seatShare: '160.00',
    amountOwed: '160.00',
    createdAt: iso(-1_800_000),
    cancelledAt: null,
    cancellationReason: null,
    ...overrides,
  }
}

/** A booking as it appears in /me/bookings — carrying its full ride. */
export function makeBookingWithRide(overrides: Partial<Booking> = {}): Booking {
  return makeBooking({
    ride: makeRide({ driver: makeDriverWithContact(), seatsTaken: 1, seatsAvailable: 2 }),
    ...overrides,
  })
}

/**
 * The driver-cancelled case from docs/API.md: frozen seatShare, zero owed,
 * a reason, and contact details withdrawn.
 */
export function makeDriverCancelledBooking(overrides: Partial<Booking> = {}): Booking {
  return makeBooking({
    status: 'CANCELLED_BY_DRIVER',
    seatShare: '100.00',
    amountOwed: '0.00',
    cancelledAt: iso(-60_000),
    cancellationReason: 'Car trouble',
    ride: makeRide({
      status: 'CANCELLED',
      cancelledAt: iso(-60_000),
      driver: makePublicDriver(),
    }),
    ...overrides,
  })
}

export { uuid as makeUuid, iso as makeIso }

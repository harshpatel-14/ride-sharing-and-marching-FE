import type { Session } from '@/features/auth'
import type { Ride, RideStatus } from '@/features/rides'
import type { Booking, BookingWithRide, BookingStatus } from '@/features/bookings'
import type { SearchResult } from '@/features/search'
import type { CostSplit } from '@/features/cost'

/**
 * Test data factories.
 *
 * Each factory's return type is the Zod-inferred domain type, so the day a
 * schema gains a required field, every factory fails to compile. That is the
 * point: mocks that drift from the contract give you a green suite testing an
 * API that no longer exists. (§12)
 */

let seq = 0
const id = (prefix: string) => `${prefix}-${String(++seq).padStart(8, '0')}-4000-8000-000000000000`
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export function resetFactories() {
  seq = 0
}

export function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    userId: uuid(1),
    name: 'Asha Rider',
    email: 'asha@example.com',
    capabilities: ['drive', 'ride'],
    ...overrides,
  }
}

export function makeRide(overrides: Partial<Ride> = {}): Ride {
  const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  return {
    id: uuid(100),
    driverId: uuid(2),
    driverName: 'Dev Driver',
    origin: { id: 'p1', label: 'Iscon Cross Road, Ahmedabad', coords: { lat: 23.0225, lng: 72.5714 } },
    destination: { id: 'p2', label: 'Vadodara Railway Station', coords: { lat: 22.3072, lng: 73.1812 } },
    departureAt: inTwoHours,
    seatsTotal: 4,
    seatsAvailable: 3,
    status: 'OPEN' satisfies RideStatus,
    estimatedCostMinor: 120_000,
    currency: 'INR',
    // Absent by default — contact appears only with a confirmed booking. (§9)
    driverContact: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

/** A ride with exactly one seat left — the setup for every last-seat test. */
export function makeLastSeatRide(overrides: Partial<Ride> = {}): Ride {
  return makeRide({ seatsTotal: 4, seatsAvailable: 1, ...overrides })
}

export function makeSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  const { driverContact: _omit, ...ride } = makeRide()
  return {
    ...ride,
    originDistanceKm: 1.2,
    destinationDistanceKm: 2.4,
    ...overrides,
  }
}

export function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: uuid(200),
    rideId: uuid(100),
    riderId: uuid(1),
    riderName: 'Asha Rider',
    seats: 1,
    status: 'CONFIRMED' satisfies BookingStatus,
    contact: { name: 'Dev Driver', phone: '+91 90000 00000' },
    shareMinor: 40_000,
    currency: 'INR',
    createdAt: new Date().toISOString(),
    cancelledAt: null,
    ...overrides,
  }
}

export function makeBookingWithRide(overrides: Partial<BookingWithRide> = {}): BookingWithRide {
  return { ...makeBooking(), ride: makeRide(), ...overrides }
}

export function makeCostSplit(overrides: Partial<CostSplit> = {}): CostSplit {
  return {
    rideId: uuid(100),
    totalMinor: 120_000,
    confirmedRiderCount: 3,
    perRiderMinor: 40_000,
    yourShareMinor: 40_000,
    currency: 'INR',
    recalculatedAt: new Date().toISOString(),
    ...overrides,
  }
}

export { id as makeId, uuid as makeUuid }

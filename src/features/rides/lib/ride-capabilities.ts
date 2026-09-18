import type { Session } from '@/features/auth'
import { isPast } from '@/lib/utils'
import type { Ride } from '../schemas'

/**
 * What the UI may offer. (§10)
 *
 * This is a RENDERING decision, not enforcement. A completed ride's
 * immutability (spec §3.6) is enforced in Express and in the database; if
 * someone POSTs directly to one they get 410 regardless of what this returns.
 *
 * It exists so that "can this be booked?" has exactly one answer across the
 * result card, the detail page, and the map popup, instead of three
 * conditionals that drift apart.
 */
export interface RideCapabilities {
  canBook: boolean
  canCancelRide: boolean
  canEdit: boolean
  canComplete: boolean
  canManageBookings: boolean
}

export function rideCapabilities(ride: Ride, session: Session | null): RideCapabilities {
  const isDriver = session !== null && ride.driverId === session.userId
  const isTerminal = ride.status === 'COMPLETED' || ride.status === 'CANCELLED'

  return {
    canBook: !isTerminal && ride.status === 'OPEN' && ride.seatsAvailable > 0 && !isDriver && session !== null,
    canCancelRide: !isTerminal && isDriver,
    canEdit: !isTerminal && isDriver,
    canComplete: isDriver && ride.status !== 'COMPLETED' && ride.status !== 'CANCELLED' && isPast(ride.departureAt),
    canManageBookings: isDriver,
  }
}

/** Terminal rides render read-only with an explanation, never a disabled-looking form. */
export function isRideTerminal(ride: Ride): boolean {
  return ride.status === 'COMPLETED' || ride.status === 'CANCELLED'
}

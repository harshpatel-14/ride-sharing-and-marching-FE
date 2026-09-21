import { isPast } from '@/lib/utils'
import { isRideTerminal, type Ride } from '../schemas'

/**
 * What the UI may offer. (§10)
 *
 * A RENDERING decision, not enforcement. A completed ride's immutability
 * (spec §3.6) is enforced by the API and by a database trigger; a direct POST
 * to one returns 409 RIDE_COMPLETED_IMMUTABLE regardless of what this says.
 *
 * It exists so "can this be booked?" has exactly one answer across the result
 * card, the detail page and the map popup, instead of three conditionals that
 * drift apart.
 *
 * Note it reads `ride.isOwner` rather than comparing ids — the backend already
 * answered that question, and re-deriving it here would be a second
 * implementation waiting to disagree.
 */
export interface RideCapabilities {
  canBook: boolean
  canCancelRide: boolean
  canEdit: boolean
  canComplete: boolean
  canManageBookings: boolean
  canViewAudit: boolean
}

export function rideCapabilities(ride: Ride): RideCapabilities {
  const terminal = isRideTerminal(ride)
  const departed = isPast(ride.departureAt)

  return {
    // The API rejects booking your own ride with 422 CANNOT_BOOK_OWN_RIDE, and
    // excludes departed and full rides from search.
    canBook: !terminal && !ride.isOwner && ride.seatsAvailable > 0 && !departed,
    canCancelRide: !terminal && ride.isOwner,
    canEdit: !terminal && ride.isOwner,
    canComplete: !terminal && ride.isOwner,
    canManageBookings: ride.isOwner,
    // Participants only; the driver always qualifies. A rider's access depends
    // on having booked, which this object cannot see — the API decides, and a
    // 404 is handled where the audit trail is rendered.
    canViewAudit: ride.isOwner,
  }
}

export { isRideTerminal }

import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './keys'

/**
 * The invalidation matrix from §5.2, as executable code rather than a table in
 * a document that drifts.
 *
 * Every seat-affecting mutation invalidates `search.all`. Search results embed
 * seat counts and `estimatedShare`; a stale result list is the "seat promised
 * twice" problem from the spec's opening paragraph in a new medium.
 *
 * Cancellations also invalidate bookings, because the backend recalculates
 * every remaining rider's `seatShare` in the same transaction — the numbers on
 * screen are wrong the instant a cancel returns. (spec §3.5)
 */

type QueryKeyish = readonly unknown[]

const invalidate = (client: QueryClient, keys: readonly QueryKeyish[]) =>
  Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })))

export const invalidateAfter = {
  bookSeat: (client: QueryClient, rideId: string) =>
    invalidate(client, [
      queryKeys.rides.detail(rideId),
      queryKeys.rides.manifest(rideId),
      queryKeys.rides.audit(rideId),
      queryKeys.search.all,
      queryKeys.bookings.mine(),
    ]),

  /** The seat is bookable again the instant this returns. (spec §3.4) */
  cancelBooking: (client: QueryClient, rideId: string, bookingId: string) =>
    invalidate(client, [
      queryKeys.rides.detail(rideId),
      queryKeys.rides.manifest(rideId),
      queryKeys.rides.audit(rideId),
      queryKeys.search.all,
      queryKeys.bookings.mine(),
      queryKeys.bookings.detail(bookingId),
    ]),

  /** Cancels every confirmed booking on the ride, so riders' lists go stale. */
  cancelRide: (client: QueryClient, rideId: string) =>
    invalidate(client, [
      queryKeys.rides.all,
      queryKeys.rides.detail(rideId),
      queryKeys.rides.mine(),
      queryKeys.rides.manifest(rideId),
      queryKeys.search.all,
      queryKeys.bookings.mine(),
    ]),

  completeRide: (client: QueryClient, rideId: string) =>
    invalidate(client, [
      queryKeys.rides.detail(rideId),
      queryKeys.rides.mine(),
      queryKeys.rides.audit(rideId),
      queryKeys.search.all,
    ]),

  createRide: (client: QueryClient) =>
    invalidate(client, [queryKeys.rides.mine(), queryKeys.search.all]),

  session: (client: QueryClient) => invalidate(client, [queryKeys.session]),
} as const

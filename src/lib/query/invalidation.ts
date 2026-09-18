import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './keys'

/**
 * The invalidation matrix from §5.2, as executable code rather than a table in
 * a document that drifts.
 *
 * Note that every seat-affecting mutation invalidates `search.all`. Search
 * results embed seat counts; a stale result list is the "seat promised twice"
 * problem from the spec's opening paragraph, reproduced in a new medium.
 */

const invalidate = (qc: QueryClient, keys: readonly QueryKeyish[]) =>
  Promise.all(keys.map((key) => qc.invalidateQueries({ queryKey: key })))

type QueryKeyish = readonly unknown[]

export const invalidateAfter = {
  bookSeat: (qc: QueryClient, rideId: string) =>
    invalidate(qc, [
      queryKeys.rides.detail(rideId),
      queryKeys.rides.bookings(rideId),
      queryKeys.rides.costSplit(rideId),
      queryKeys.search.all,
      queryKeys.bookings.mine(),
    ]),

  /** Seat returns to availability immediately — no stale "still booked" window. (spec §3.4) */
  cancelBooking: (qc: QueryClient, rideId: string, bookingId: string) =>
    invalidate(qc, [
      queryKeys.rides.detail(rideId),
      queryKeys.rides.bookings(rideId),
      queryKeys.rides.costSplit(rideId),
      queryKeys.search.all,
      queryKeys.bookings.mine(),
      queryKeys.bookings.detail(bookingId),
    ]),

  /** Cancels every booking on the ride, so the rider's list must refetch too. */
  cancelRide: (qc: QueryClient, rideId: string) =>
    invalidate(qc, [
      queryKeys.rides.all,
      queryKeys.rides.detail(rideId),
      queryKeys.rides.mine(),
      queryKeys.search.all,
      queryKeys.bookings.mine(),
    ]),

  completeRide: (qc: QueryClient, rideId: string) =>
    invalidate(qc, [
      queryKeys.rides.detail(rideId),
      queryKeys.rides.mine(),
      queryKeys.search.all,
    ]),

  createRide: (qc: QueryClient) =>
    invalidate(qc, [queryKeys.rides.mine(), queryKeys.search.all]),

  session: (qc: QueryClient) => invalidate(qc, [queryKeys.session]),
} as const

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  isAlreadyBooked,
  isRideTerminalError,
  isSeatUnavailable,
  toUserMessage,
} from '@/lib/api'
import { invalidateAfter, queryKeys } from '@/lib/query'
import { logger } from '@/lib/logger'
import { bookingsApi } from '../api/bookings.api'

/**
 * Booking mutations. (§6, spec §3.3)
 *
 * `retry: false` everywhere is load-bearing. Booking is not idempotent: a
 * retried POST after a network timeout can claim a second seat for a request
 * that already succeeded. If retry safety is wanted it belongs in the API
 * contract as an Idempotency-Key, not in client-side cleverness.
 *
 * And the seat count is never decremented optimistically. Two riders tap Book
 * on the last seat and exactly one wins — you cannot know you were the one,
 * so showing a decremented count is showing a booking the database may be
 * about to refuse.
 */

export function useMyBookings() {
  return useQuery({
    queryKey: queryKeys.bookings.mine(),
    queryFn: () => bookingsApi.listMine(),
  })
}

/** Driver's manifest for their own ride. Anyone else gets 404. */
export function useRideManifest(rideId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.rides.manifest(rideId),
    queryFn: () => bookingsApi.manifest(rideId),
    enabled,
  })
}

export interface SeatConflict {
  kind: 'taken' | 'already-booked'
  message: string
}

export function useBookSeat(
  rideId: string,
  handlers: { onConflict?: (conflict: SeatConflict) => void } = {},
) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: () => bookingsApi.create(rideId),
    retry: false,

    onSuccess: async (booking) => {
      logger.info('booking.created', { rideId, bookingId: booking.id })
      // Contact details become visible now — but we refetch rather than
      // synthesise them, and let the server decide what to include. (§9)
      await invalidateAfter.bookSeat(queryClient, rideId)
      toast.success('Seat confirmed')
      router.push('/bookings')
    },

    onError: async (error) => {
      /*
       * The sharpest path in the product. Losing the last seat is a NORMAL
       * outcome on a popular ride, not a failure — so refresh to the truth
       * and hand the rider somewhere to go, never a red "something went
       * wrong" toast.
       */
      if (isSeatUnavailable(error) || isAlreadyBooked(error)) {
        logger.info('booking.conflict', { rideId, code: error.code })
        await invalidateAfter.bookSeat(queryClient, rideId)
        handlers.onConflict?.({
          kind: isAlreadyBooked(error) ? 'already-booked' : 'taken',
          message: toUserMessage(error),
        })
        return
      }

      if (isRideTerminalError(error)) {
        await invalidateAfter.bookSeat(queryClient, rideId)
      }
      toast.error(toUserMessage(error))
    },
  })
}

/** Callable by the rider who holds the booking OR the driver of the ride. */
export function useCancelBooking(bookingId: string, rideId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (reason?: string) => bookingsApi.cancel(bookingId, reason),
    retry: false,
    onSuccess: async ({ seatsAvailable }) => {
      logger.info('booking.cancelled', { bookingId, rideId, seatsAvailable })
      await invalidateAfter.cancelBooking(queryClient, rideId, bookingId)
      // Every remaining rider's share just went UP; the numbers on screen are
      // stale until the refetch lands. (spec §3.5)
      toast.success('Booking cancelled. The seat is available again.')
    },
    onError: (error) => toast.error(toUserMessage(error)),
  })
}

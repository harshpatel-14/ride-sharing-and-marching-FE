'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { isRideTerminalError, toUserMessage } from '@/lib/api'
import { invalidateAfter } from '@/lib/query'
import { logger } from '@/lib/logger'
import { ridesApi } from '../api/rides.api'
import type { CreateRideInput } from '../schemas'

/**
 * Ride write operations.
 *
 * Every one sets `retry: false`. Posting, cancelling and completing are not
 * idempotent, and TanStack Query's default retry would fire a second request
 * for one that may already have succeeded. Retry safety belongs in the API
 * contract as an Idempotency-Key, not in client-side cleverness. (§6.1)
 *
 * The terminal-ride branch matters: a ride that went COMPLETED or CANCELLED
 * while the page was open is a stale-view problem, not a failure, and the user
 * needs to be told which.
 */

export function useCreateRide() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: (input: CreateRideInput) => ridesApi.create(input),
    retry: false,
    onSuccess: async (ride) => {
      logger.info('ride.created', { rideId: ride.id, seatsTotal: ride.seatsTotal })
      await invalidateAfter.createRide(queryClient)
      toast.success('Ride posted')
      router.push(`/rides/${ride.id}`)
    },
    onError: (error) => {
      logger.warn('ride.create_failed', { message: error.message })
      toast.error(toUserMessage(error))
    },
  })
}

export function useCancelRide(rideId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (reason?: string) => ridesApi.cancel(rideId, reason),
    retry: false,
    onSuccess: async ({ bookingsCancelled }) => {
      logger.info('ride.cancelled', { rideId, bookingsCancelled })
      await invalidateAfter.cancelRide(queryClient, rideId)
      // Riders keep a visible CANCELLED_BY_DRIVER record; nothing is deleted.
      toast.success(
        bookingsCancelled > 0
          ? `Ride cancelled. ${bookingsCancelled} booking${bookingsCancelled === 1 ? '' : 's'} cancelled too.`
          : 'Ride cancelled.',
      )
    },
    onError: async (error) => {
      if (isRideTerminalError(error)) {
        await invalidateAfter.cancelRide(queryClient, rideId)
      }
      toast.error(toUserMessage(error))
    },
  })
}

export function useCompleteRide(rideId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => ridesApi.complete(rideId),
    retry: false,
    onSuccess: async () => {
      logger.info('ride.completed', { rideId })
      await invalidateAfter.completeRide(queryClient, rideId)
      toast.success('Ride marked complete. It is now locked.')
    },
    onError: async (error) => {
      if (isRideTerminalError(error)) {
        await invalidateAfter.completeRide(queryClient, rideId)
      }
      toast.error(toUserMessage(error))
    },
  })
}

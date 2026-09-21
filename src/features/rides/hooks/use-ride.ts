'use client'

import { useQuery } from '@tanstack/react-query'
import { LIVE } from '@/config/constants'
import { queryKeys } from '@/lib/query'
import { ridesApi } from '../api/rides.api'

/**
 * A single ride, kept fresh while the tab is focused.
 *
 * Polling is the phase-1 transport for seat freshness — one line and honest.
 * When SSE lands (§6.3) the swap happens here and no call site changes.
 */
export function useRide(rideId: string, options: { live?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.rides.detail(rideId),
    queryFn: () => ridesApi.getById(rideId),
    ...(options.live
      ? {
          refetchInterval: LIVE.RIDE_DETAIL_POLL_MS,
          // Don't poll a backgrounded tab: it burns the rider's battery and
          // our rate limit to refresh a number nobody is looking at.
          refetchIntervalInBackground: false,
        }
      : {}),
  })
}

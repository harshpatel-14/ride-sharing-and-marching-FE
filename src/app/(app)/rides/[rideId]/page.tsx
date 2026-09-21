import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { RideDetail } from '@/features/rides'
import { serverRidesApi } from '@/features/rides/server'
import { isNotFound } from '@/lib/api'
import { Hydrate, makeQueryClient, queryKeys } from '@/lib/query'

export const metadata: Metadata = { title: 'Ride' }

/**
 * RSC prefetch → client hydration (§5.4): the ride renders on first paint with
 * no spinner, then TanStack Query takes over for polling and mutations.
 */
export default async function RideDetailPage({ params }: { params: Promise<{ rideId: string }> }) {
  const { rideId } = await params
  const queryClient = makeQueryClient()

  try {
    await queryClient.fetchQuery({
      queryKey: queryKeys.rides.detail(rideId),
      queryFn: () => serverRidesApi.getById(rideId),
    })
  } catch (error) {
    // The API returns 404 for "does not exist" AND "not yours", deliberately,
    // so ids cannot be probed. The UI must not reintroduce the distinction.
    if (isNotFound(error)) notFound()
    throw error
  }

  return (
    <Hydrate client={queryClient}>
      <RideDetail rideId={rideId} />
    </Hydrate>
  )
}

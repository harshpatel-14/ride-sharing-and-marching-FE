import { HydrationBoundary, dehydrate, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/**
 * RSC prefetch → client hydration. (§5.4)
 *
 * Usage in a Server Component:
 *
 *   const qc = makeQueryClient()
 *   await qc.prefetchQuery({ queryKey: queryKeys.rides.detail(id), queryFn: ... })
 *   return <Hydrate client={qc}><RideDetail rideId={id} /></Hydrate>
 */
export function Hydrate({ client, children }: { client: QueryClient; children: ReactNode }) {
  return <HydrationBoundary state={dehydrate(client)}>{children}</HydrationBoundary>
}

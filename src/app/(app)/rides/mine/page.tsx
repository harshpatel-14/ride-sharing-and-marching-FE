import type { Metadata } from 'next'
import Link from 'next/link'
import { MyRidesList } from '@/features/rides'
import { serverRidesApi } from '@/features/rides/server'
import { buttonVariants } from '@/components/ui'
import { Hydrate, makeQueryClient, queryKeys } from '@/lib/query'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'My rides' }

export default async function MyRidesPage() {
  const queryClient = makeQueryClient()
  await queryClient.prefetchQuery({
    queryKey: queryKeys.rides.mine(),
    queryFn: () => serverRidesApi.listMine(),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">My rides</h1>
        <Link href="/rides/new" className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}>
          Offer a ride
        </Link>
      </div>

      <Hydrate client={queryClient}>
        <MyRidesList />
      </Hydrate>
    </div>
  )
}

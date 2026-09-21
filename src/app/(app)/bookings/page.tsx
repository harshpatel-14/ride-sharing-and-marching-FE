import type { Metadata } from 'next'
import { MyBookingsList } from '@/features/bookings'
import { serverBookingsApi } from '@/features/bookings/server'
import { Hydrate, makeQueryClient, queryKeys } from '@/lib/query'

export const metadata: Metadata = { title: 'My bookings' }

export default async function MyBookingsPage() {
  // Prefetched so the list is present on first paint, matching /rides/mine.
  // Without this the page server-renders an empty spinner. (§5.4)
  const queryClient = makeQueryClient()
  await queryClient.prefetchQuery({
    queryKey: queryKeys.bookings.mine(),
    queryFn: () => serverBookingsApi.listMine(),
  })

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">My bookings</h1>
        <p className="text-sm text-fg-muted">
          Cancelled bookings stay here as a record — including the share you were quoted.
        </p>
      </div>

      <Hydrate client={queryClient}>
        <MyBookingsList />
      </Hydrate>
    </div>
  )
}

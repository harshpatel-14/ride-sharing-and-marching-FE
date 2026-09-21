'use client'

import Link from 'next/link'
import { buttonVariants, Spinner } from '@/components/ui'
import { EmptyState } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { toUserMessage } from '@/lib/api'
import { useMyRides } from '../hooks/use-my-rides'
import { RideCard } from './ride-card'

export function MyRidesList() {
  const { data, isPending, isError, error } = useMyRides()

  if (isPending) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading your rides" className="size-6" />
      </div>
    )
  }

  if (isError) {
    return <p className="text-sm text-danger">{toUserMessage(error)}</p>
  }

  const rides = data.rides

  if (rides.length === 0) {
    return (
      <EmptyState
        title="You haven’t posted a ride yet"
        description="Post one with your route, departure time and seat count, and riders going the same way can find it."
        action={
          <Link href="/rides/new" className={cn(buttonVariants({ variant: 'primary' }))}>
            Offer a ride
          </Link>
        }
      />
    )
  }

  return (
    <ul className="space-y-3">
      {rides.map((ride) => (
        <li key={ride.id}>
          <RideCard ride={ride} />
        </li>
      ))}
    </ul>
  )
}

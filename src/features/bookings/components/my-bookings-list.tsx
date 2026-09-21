'use client'

import Link from 'next/link'
import { Spinner, buttonVariants } from '@/components/ui'
import { EmptyState } from '@/components/feedback'
import { toUserMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useMyBookings } from '../hooks/use-bookings'
import { BookingCard } from './booking-card'

export function MyBookingsList() {
  const { data, isPending, isError, error } = useMyBookings()

  if (isPending) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading your bookings" className="size-6" />
      </div>
    )
  }

  if (isError) return <p className="text-sm text-danger">{toUserMessage(error)}</p>

  if (data.bookings.length === 0) {
    return (
      <EmptyState
        title="No bookings yet"
        description="Search for a ride going your way at roughly your time, and book a seat."
        action={
          <Link href="/search" className={cn(buttonVariants({ variant: 'primary' }))}>
            Find a ride
          </Link>
        }
      />
    )
  }

  // Confirmed first, then history — cancelled bookings are kept, not hidden.
  const sorted = [...data.bookings].sort((a, b) => {
    const rank = (s: string) => (s === 'CONFIRMED' ? 0 : 1)
    return rank(a.status) - rank(b.status) || b.createdAt.localeCompare(a.createdAt)
  })

  return (
    <ul className="space-y-3">
      {sorted.map((booking) => (
        <li key={booking.id}>
          <BookingCard booking={booking} />
        </li>
      ))}
    </ul>
  )
}

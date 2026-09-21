'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { formatDateTime, formatMoney } from '@/lib/utils'
import type { Booking, BookingStatus } from '../schemas'
import { CancelBookingDialog } from './cancel-booking-dialog'

const STATUS: Record<BookingStatus, { label: string; tone: 'success' | 'neutral' | 'danger' }> = {
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  CANCELLED_BY_RIDER: { label: 'You cancelled', tone: 'neutral' },
  CANCELLED_BY_DRIVER: { label: 'Driver cancelled', tone: 'danger' },
}

/**
 * One booking in the rider's list.
 *
 * Cancelled bookings stay visible — they are never deleted, and a rider whose
 * ride was cancelled needs the record more than anyone. The driver-cancelled
 * case gets a persistent banner with the reason and a route forward. (§10)
 *
 * Note the two money fields are shown separately on a cancelled booking:
 * `seatShare` is what the rider was quoted, `amountOwed` is what they owe.
 * Collapsing them would make it impossible to tell "paid 150" from "was
 * quoted 150, then the driver cancelled".
 */
export function BookingCard({ booking }: { booking: Booking }) {
  const ride = booking.ride
  const status = STATUS[booking.status]
  const cancelledByDriver = booking.status === 'CANCELLED_BY_DRIVER'
  const active = booking.status === 'CONFIRMED'

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {ride ? (
            <p className="flex flex-wrap items-center gap-2 font-medium">
              <span className="truncate">{ride.origin.label}</span>
              <ArrowRight className="size-4 shrink-0 text-fg-muted" aria-hidden />
              <span className="truncate">{ride.destination.label}</span>
            </p>
          ) : null}
          {ride ? <p className="text-sm text-fg-muted">{formatDateTime(ride.departureAt)}</p> : null}
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      {cancelledByDriver ? (
        <div role="status" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <div className="space-y-2">
            <p>
              The driver cancelled this ride
              {booking.cancellationReason ? `: “${booking.cancellationReason}”` : '.'}
            </p>
            <p className="text-fg-muted">You owe nothing. Their contact details are no longer shared.</p>
            <Link href="/search" className="font-medium text-brand underline-offset-2 hover:underline">
              Find another ride
            </Link>
          </div>
        </div>
      ) : null}

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-fg-muted">{active ? 'Your share' : 'Quoted share'}</dt>
          <dd className="font-medium">{formatMoney(booking.seatShare)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-fg-muted">Owed</dt>
          <dd className="font-medium">{formatMoney(booking.amountOwed)}</dd>
        </div>
      </dl>

      {active ? (
        <p className="text-xs text-fg-muted">
          Your share is recalculated whenever the confirmed riders change — it goes up if someone
          else cancels.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {ride ? (
          <Link
            href={`/rides/${ride.id}`}
            className="text-sm font-medium text-brand underline-offset-2 hover:underline"
          >
            View ride
          </Link>
        ) : (
          <span />
        )}
        {active && ride ? (
          <CancelBookingDialog bookingId={booking.id} rideId={ride.id} />
        ) : null}
      </div>
    </Card>
  )
}

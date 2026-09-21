import Link from 'next/link'
import { ArrowRight, Clock } from 'lucide-react'
import { Card } from '@/components/ui'
import { formatDateTime, formatMoney } from '@/lib/utils'
import type { Ride } from '../schemas'
import { RideStatusBadge } from './ride-status-badge'
import { SeatBadge } from './seat-badge'

export function RideCard({ ride }: { ride: Ride }) {
  return (
    <Card className="transition-colors hover:border-brand/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="truncate">{ride.origin.label}</span>
            <ArrowRight className="size-4 shrink-0 text-fg-muted" aria-hidden />
            <span className="truncate">{ride.destination.label}</span>
          </p>
          <p className="text-sm text-fg-muted">
            {formatDateTime(ride.departureAt)} · {formatMoney(ride.estimatedCost)} total
          </p>
          {ride.flexMinutes > 0 ? (
            <p className="flex items-center gap-1 text-xs text-fg-muted">
              <Clock className="size-3" aria-hidden />
              ±{ride.flexMinutes} min flexible
            </p>
          ) : null}
        </div>
        <RideStatusBadge status={ride.status} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <SeatBadge seatsAvailable={ride.seatsAvailable} seatsTotal={ride.seatsTotal} />
        <Link
          href={`/rides/${ride.id}`}
          className="text-sm font-medium text-brand underline-offset-2 hover:underline"
        >
          View ride
          <span className="sr-only">
            {' '}
            from {ride.origin.label} to {ride.destination.label}
          </span>
        </Link>
      </div>
    </Card>
  )
}

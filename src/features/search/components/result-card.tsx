import Link from 'next/link'
import { ArrowRight, Clock, MapPin } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { formatDistance } from '@/lib/geo'
import { formatDateTime, formatMoney } from '@/lib/utils'
import type { SearchResult } from '../schemas'

/**
 * One matched ride.
 *
 * Shows `estimatedShare`, not `estimatedCost`: the share is what this rider
 * would actually pay if they joined, computed by the backend for the current
 * confirmed riders plus them. Leading with the whole-ride cost would quote
 * people a number they will never be charged.
 *
 * The distances are labels on a result the server already selected. They are
 * never used to filter — that would duplicate the indexed matching query and
 * lie across the top-N boundary.
 */
export function ResultCard({
  result,
  onHover,
  active,
}: {
  result: SearchResult
  onHover?: (rideId: string | null) => void
  active?: boolean
}) {
  return (
    <Card
      onMouseEnter={() => onHover?.(result.id)}
      onMouseLeave={() => onHover?.(null)}
      className={active ? 'border-brand' : 'transition-colors hover:border-brand/40'}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="truncate">{result.origin.label}</span>
            <ArrowRight className="size-4 shrink-0 text-fg-muted" aria-hidden />
            <span className="truncate">{result.destination.label}</span>
          </p>
          <p className="text-sm text-fg-muted">
            {formatDateTime(result.departureAt)}
            {result.flexMinutes > 0 ? ` · ±${result.flexMinutes} min` : ''}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-semibold">{formatMoney(result.estimatedShare)}</p>
          <p className="text-xs text-fg-muted">your share</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3" aria-hidden />
          {formatDistance(result.originMeters)} from pickup
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3" aria-hidden />
          {formatDistance(result.destMeters)} from drop-off
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" aria-hidden />
          {formatMoney(result.estimatedCost)} total
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone={result.seatsAvailable === 1 ? 'warning' : 'neutral'}>
            {result.seatsAvailable} of {result.seatsTotal} seats free
          </Badge>
          <span className="text-sm text-fg-muted">{result.driver.fullName}</span>
        </div>
        <Link
          href={`/rides/${result.id}`}
          className="text-sm font-medium text-brand underline-offset-2 hover:underline"
        >
          View
          <span className="sr-only">
            {' '}
            ride from {result.origin.label} to {result.destination.label}
          </span>
        </Link>
      </div>
    </Card>
  )
}

'use client'

import { ArrowRight, CalendarClock, Clock, Wallet } from 'lucide-react'
import Link from 'next/link'
import { BookSeatButton } from '@/features/bookings'
import { Button, Card, CardHeader, CardTitle, Spinner, buttonVariants } from '@/components/ui'
import { cn, formatDateTime, formatMoney, formatRelative, formatTimeWindow } from '@/lib/utils'
import { toUserMessage } from '@/lib/api'
import { rideCapabilities } from '../lib/ride-capabilities'
import { useRide } from '../hooks/use-ride'
import { useCancelRide, useCompleteRide } from '../hooks/use-ride-mutations'
import { ConfirmActionDialog } from './confirm-action-dialog'
import { ContactPanel } from './contact-panel'
import { RideStatusBadge } from './ride-status-badge'
import { SeatBadge } from './seat-badge'
import { TerminalRideNotice } from './terminal-ride-notice'

/**
 * Ride detail.
 *
 * Hydrated from an RSC prefetch, then polled while open so the seat count
 * stays honest (§5.4, §6.3). Everything it renders — seats, cost, contact
 * visibility, which buttons exist — comes from the server payload.
 */
export function RideDetail({ rideId }: { rideId: string }) {
  const { data: ride, isPending, isError, error } = useRide(rideId, { live: true })
  const cancelRide = useCancelRide(rideId)
  const completeRide = useCompleteRide(rideId)

  if (isPending) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading ride" className="size-6" />
      </div>
    )
  }

  if (isError) {
    return (
      <Card>
        <p className="text-sm text-danger">{toUserMessage(error)}</p>
      </Card>
    )
  }

  const caps = rideCapabilities(ride)

  return (
    <div className="space-y-5">
      <TerminalRideNotice ride={ride} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">
              <span className="inline-flex flex-wrap items-center gap-2">
                {ride.origin.label}
                <ArrowRight className="size-4 text-fg-muted" aria-hidden />
                {ride.destination.label}
              </span>
            </CardTitle>
            <RideStatusBadge status={ride.status} />
          </div>
        </CardHeader>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 shrink-0 text-fg-muted" aria-hidden />
            <dt className="sr-only">Departure</dt>
            <dd>
              {formatDateTime(ride.departureAt)}{' '}
              <span className="text-fg-muted">({formatRelative(ride.departureAt)})</span>
            </dd>
          </div>

          <div className="flex items-center gap-2">
            <Wallet className="size-4 shrink-0 text-fg-muted" aria-hidden />
            <dt className="sr-only">Estimated total cost</dt>
            <dd>
              {formatMoney(ride.estimatedCost)}{' '}
              <span className="text-fg-muted">estimated total for the ride</span>
            </dd>
          </div>

          {/*
            The matching window, not just the departure time. This is what
            search actually compares against, so showing it explains why a
            ride appears for a time the driver did not literally type.
          */}
          <div className="flex items-center gap-2 sm:col-span-2">
            <Clock className="size-4 shrink-0 text-fg-muted" aria-hidden />
            <dt className="sr-only">Matching window</dt>
            <dd className="text-fg-muted">
              Matches searches between{' '}
              {formatTimeWindow(ride.departureWindow.from, ride.departureWindow.to)}
              {ride.flexMinutes > 0 ? ` (±${ride.flexMinutes} min flexibility)` : ' (no flexibility set)'}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <SeatBadge seatsAvailable={ride.seatsAvailable} seatsTotal={ride.seatsTotal} />
          <span className="text-sm text-fg-muted">
            {ride.isOwner ? 'You are driving' : `Driver: ${ride.driver.fullName}`}
          </span>
        </div>
      </Card>

      {/*
        Renders only when the API sent contact details, which it does only for
        the driver or a confirmed rider. No client-side visibility rule. (§9)
      */}
      <ContactPanel driver={ride.driver} />

      {(caps.canComplete || caps.canCancelRide) && (
        <div className="flex flex-wrap gap-2">
          {caps.canComplete && (
            <ConfirmActionDialog
              trigger={<Button variant="secondary">Mark complete</Button>}
              title="Mark this ride complete?"
              description="Completed rides are locked permanently — no new bookings, no cancellations, and no changes to the route or seats. This cannot be undone."
              confirmLabel="Mark complete"
              variant="primary"
              pending={completeRide.isPending}
              onConfirm={() => completeRide.mutateAsync()}
            />
          )}

          {caps.canCancelRide && (
            <ConfirmActionDialog
              trigger={<Button variant="danger">Cancel ride</Button>}
              title="Cancel this ride?"
              description="Every confirmed booking on this ride will be cancelled and each rider will be told the driver cancelled. This cannot be undone."
              confirmLabel="Cancel ride"
              withReason
              reasonLabel="Reason (optional)"
              reasonPlaceholder="Car trouble"
              pending={cancelRide.isPending}
              onConfirm={(reason) => cancelRide.mutateAsync(reason)}
            />
          )}
        </div>
      )}

      {caps.canBook && (
        <Card>
          <BookSeatButton rideId={ride.id} seatsAvailable={ride.seatsAvailable} />
        </Card>
      )}

      {caps.canManageBookings && (
        <Link
          href={`/rides/${ride.id}/manage`}
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          Manage bookings
        </Link>
      )}
    </div>
  )
}

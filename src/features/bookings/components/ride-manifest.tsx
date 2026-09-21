'use client'

import { Card, Spinner } from '@/components/ui'
import { EmptyState } from '@/components/feedback'
import { toUserMessage } from '@/lib/api'
import { formatDateTime, formatMoney } from '@/lib/utils'
import { riderHasContact } from '../schemas'
import { useRideManifest } from '../hooks/use-bookings'
import { CancelBookingDialog } from './cancel-booking-dialog'

/**
 * The driver's view of who is on their ride.
 *
 * Only the driver can read this — anyone else, including a rider ON the ride,
 * gets 404. Confirmed riders carry contact details; cancelled ones do not,
 * and that withdrawal is the backend's doing, not a filter here. (§9)
 */
export function RideManifest({ rideId }: { rideId: string }) {
  const { data, isPending, isError, error } = useRideManifest(rideId)

  if (isPending) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading bookings" className="size-6" />
      </div>
    )
  }

  if (isError) return <p className="text-sm text-danger">{toUserMessage(error)}</p>

  if (data.bookings.length === 0) {
    return <EmptyState title="Nobody has booked yet" description="Riders who match your route and time will find this ride in search." />
  }

  return (
    <ul className="space-y-3">
      {data.bookings.map((booking) => {
        const rider = booking.rider
        const confirmed = booking.status === 'CONFIRMED'

        return (
          <li key={booking.id}>
            <Card className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{rider?.fullName ?? 'Rider'}</p>
                  <p className="text-sm text-fg-muted">
                    Booked {formatDateTime(booking.createdAt)}
                  </p>
                </div>
                <p className="text-sm">
                  <span className="font-medium">{formatMoney(booking.seatShare)}</span>
                  <span className="text-fg-muted"> share</span>
                </p>
              </div>

              {/* Present only for confirmed riders — the server decides. */}
              {rider && riderHasContact(rider) ? (
                <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-fg-muted">Phone</dt>
                    <dd>
                      <a href={`tel:${rider.phone}`} className="text-brand underline-offset-2 hover:underline">
                        {rider.phone}
                      </a>
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-fg-muted">Email</dt>
                    <dd>
                      <a href={`mailto:${rider.email}`} className="text-brand underline-offset-2 hover:underline">
                        {rider.email}
                      </a>
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-fg-muted">
                  {confirmed ? 'Contact details unavailable.' : 'Cancelled — contact details withdrawn.'}
                </p>
              )}

              {confirmed ? (
                <div className="flex justify-end">
                  <CancelBookingDialog bookingId={booking.id} rideId={rideId} label="Remove rider" />
                </div>
              ) : null}
            </Card>
          </li>
        )
      })}
    </ul>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RideManifest } from '@/features/bookings'
import { serverRidesApi } from '@/features/rides/server'
import { isNotFound } from '@/lib/api'

export const metadata: Metadata = { title: 'Manage bookings' }

/**
 * The driver's manifest.
 *
 * Only the driver of this ride can read it; the API returns 404 to everyone
 * else, including riders on the ride. We fetch the ride first so a non-owner
 * gets the same not-found page rather than an empty manifest — but the
 * enforcement is the API's either way.
 */
export default async function ManageBookingsPage({
  params,
}: {
  params: Promise<{ rideId: string }>
}) {
  const { rideId } = await params

  // The fetch is wrapped, the JSX is not: constructing elements inside a
  // try/catch hides render-time errors in the same handler as fetch errors.
  const ride = await serverRidesApi.getById(rideId).catch((error: unknown) => {
    if (isNotFound(error)) notFound()
    throw error
  })

  if (!ride.isOwner) notFound()

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href={`/rides/${rideId}`}
          className="text-sm text-brand underline-offset-2 hover:underline"
        >
          ← Back to ride
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Bookings on this ride</h1>
        <p className="text-sm text-fg-muted">
          {ride.origin.label} → {ride.destination.label} · {ride.seatsTaken} of {ride.seatsTotal}{' '}
          seats taken
        </p>
      </div>

      <RideManifest rideId={rideId} />
    </div>
  )
}

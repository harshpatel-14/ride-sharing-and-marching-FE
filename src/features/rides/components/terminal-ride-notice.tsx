import { CheckCircle2, XCircle } from 'lucide-react'
import { isRideTerminal, type Ride } from '../schemas'

/**
 * The completed/cancelled lock. (§10, spec §3.6)
 *
 * A terminal ride renders a read-only explanation rather than a form full of
 * disabled controls — a disabled button invites the user to wonder what they
 * did wrong, whereas a sentence tells them.
 *
 * Presentation only. Immutability is enforced by the API and by a database
 * trigger; a direct POST returns 409 RIDE_COMPLETED_IMMUTABLE regardless.
 */
export function TerminalRideNotice({ ride }: { ride: Ride }) {
  if (!isRideTerminal(ride)) return null

  const completed = ride.status === 'COMPLETED'
  const Icon = completed ? CheckCircle2 : XCircle

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-card border p-4 text-sm ${
        completed ? 'border-border bg-surface-muted' : 'border-danger/30 bg-danger/10'
      }`}
    >
      <Icon
        className={`mt-0.5 size-4 shrink-0 ${completed ? 'text-fg-muted' : 'text-danger'}`}
        aria-hidden
      />
      <div className="space-y-1">
        <p className="font-medium">
          {completed ? 'This ride is completed' : 'This ride was cancelled'}
        </p>
        <p className="text-fg-muted">
          {completed
            ? 'Completed rides are locked. Its route, seats and bookings can no longer be changed.'
            : 'The driver cancelled this ride, and every confirmed booking on it was cancelled too.'}
        </p>
      </div>
    </div>
  )
}

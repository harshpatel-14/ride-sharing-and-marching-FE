import { Badge } from '@/components/ui'

/**
 * Seat availability, straight from the server payload.
 *
 * No arithmetic beyond rendering the numbers given. The count is advisory
 * until the booking call returns — the client never decrements it
 * optimistically, because you cannot know you won the race for the last seat.
 * (§0.1, §6.1, docs/API.md on POST /rides/:id/bookings)
 */
export function SeatBadge({
  seatsAvailable,
  seatsTotal,
}: {
  seatsAvailable: number
  seatsTotal: number
}) {
  const none = seatsAvailable === 0
  const last = seatsAvailable === 1

  return (
    <Badge tone={none ? 'danger' : last ? 'warning' : 'neutral'}>
      {none ? 'No seats left' : `${seatsAvailable} of ${seatsTotal} seats free`}
    </Badge>
  )
}

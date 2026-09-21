import { Badge } from '@/components/ui'
import { assertNever } from '@/lib/utils'
import type { RideStatus } from '../schemas'

const LABELS: Record<RideStatus, string> = {
  OPEN: 'Open',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
}

function toneFor(status: RideStatus) {
  switch (status) {
    case 'OPEN':
      return 'success' as const
    case 'CANCELLED':
      return 'danger' as const
    case 'COMPLETED':
      return 'neutral' as const
    default:
      // Adding a status without handling it here is a type error.
      return assertNever(status)
  }
}

export function RideStatusBadge({ status }: { status: RideStatus }) {
  return <Badge tone={toneFor(status)}>{LABELS[status]}</Badge>
}

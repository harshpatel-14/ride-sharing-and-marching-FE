import { Card, CardHeader, CardTitle } from '@/components/ui'
import { hasContact, type Driver } from '../schemas'

/**
 * Driver contact details. (§9, spec §3.7)
 *
 * Renders if and only if the API sent them, which it does only when the caller
 * is the driver or holds a CONFIRMED booking. There is deliberately no
 * `canViewContact` prop and no status check: the rule has one implementation
 * and it lives in the backend's query.
 *
 * The payoff shows on cancellation — when a booking stops being confirmed the
 * columns stop being fetched, and this panel disappears on the next read with
 * no client-side cleanup to forget.
 */
export function ContactPanel({ driver, heading = 'Driver contact' }: { driver: Driver; heading?: string }) {
  if (!hasContact(driver)) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{heading}</CardTitle>
      </CardHeader>
      <dl className="space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-fg-muted">Name</dt>
          <dd>{driver.fullName}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-fg-muted">Phone</dt>
          <dd>
            <a href={`tel:${driver.phone}`} className="text-brand underline-offset-2 hover:underline">
              {driver.phone}
            </a>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-fg-muted">Email</dt>
          <dd>
            <a href={`mailto:${driver.email}`} className="text-brand underline-offset-2 hover:underline">
              {driver.email}
            </a>
          </dd>
        </div>
      </dl>
    </Card>
  )
}

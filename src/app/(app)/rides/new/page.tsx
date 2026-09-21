import type { Metadata } from 'next'
import { RideForm } from '@/features/rides'

export const metadata: Metadata = { title: 'Offer a ride' }

export default function NewRidePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Offer a ride</h1>
        <p className="text-sm text-fg-muted">
          Riders heading the same way at a similar time will be matched to this by the search query.
        </p>
      </div>

      <RideForm />
    </div>
  )
}

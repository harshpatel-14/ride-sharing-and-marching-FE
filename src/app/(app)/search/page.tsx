import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SearchPane } from '@/features/search'
import { Spinner } from '@/components/ui'

export const metadata: Metadata = { title: 'Find a ride' }

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Find a ride</h1>
        <p className="text-sm text-fg-muted">
          A ride matches when both ends of its route are near yours <em>and</em> its departure
          window overlaps the times you gave.
        </p>
      </div>

      {/* useSearchParams needs a Suspense boundary to keep the shell static. */}
      <Suspense fallback={<div className="flex justify-center py-16"><Spinner label="Loading search" className="size-6" /></div>}>
        <SearchPane />
      </Suspense>
    </div>
  )
}

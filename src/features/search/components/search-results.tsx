'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { SearchX } from 'lucide-react'
import { Card, Spinner } from '@/components/ui'
import { EmptyState } from '@/components/feedback'
import { toUserMessage } from '@/lib/api'
import { formatRelative } from '@/lib/utils'
import { useSearchRides } from '../hooks/use-search-rides'
import type { SearchQuery } from '../schemas'
import { ResultCard } from './result-card'

/**
 * MapLibre is ~200KB gzipped, so it is split out and never server-rendered.
 * The skeleton holds the space so the layout does not jump when it lands.
 */
const ResultMap = dynamic(() => import('./result-map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-80 items-center justify-center rounded-card border border-border bg-surface-muted">
      <Spinner label="Loading map" />
    </div>
  ),
})

export function SearchResults({ query }: { query: SearchQuery }) {
  const { data, isPending, isError, error, isFetching } = useSearchRides(query)
  const [activeId, setActiveId] = useState<string | null>(null)
  const mapStyleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Searching for rides" className="size-6" />
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

  const { rides, searchedAt } = data

  if (rides.length === 0) {
    return (
      <EmptyState
        title="No rides match yet"
        description="Matching needs BOTH ends of your route to be close AND the times to overlap — a ride going your way at the wrong time will not appear. Try a wider radius or a longer window."
        action={<SearchX className="size-5 text-fg-muted" aria-hidden />}
      />
    )
  }

  const origin = { lat: query.originLat, lng: query.originLng }
  const destination = { lat: query.destLat, lng: query.destLng }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-sm text-fg-muted">
        <p>
          {rides.length} matching {rides.length === 1 ? 'ride' : 'rides'}
        </p>
        <p className="flex items-center gap-2">
          {isFetching ? <Spinner label="Refreshing results" /> : null}
          <span>searched {formatRelative(searchedAt)}</span>
        </p>
      </div>

      <div className={mapStyleUrl ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : ''}>
        <ul className="space-y-3">
          {rides.map((result) => (
            <li key={result.id}>
              <ResultCard result={result} onHover={setActiveId} active={result.id === activeId} />
            </li>
          ))}
        </ul>

        {/*
          Both panes render from the same `rides` array. The map is optional:
          with no style URL configured the list simply takes the full width.
        */}
        {mapStyleUrl ? (
          <div className="lg:sticky lg:top-4 lg:h-[calc(100dvh-8rem)]">
            <ResultMap
              results={rides}
              origin={origin}
              destination={destination}
              activeId={activeId}
              styleUrl={mapStyleUrl}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

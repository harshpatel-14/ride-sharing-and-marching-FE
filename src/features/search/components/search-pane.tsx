'use client'

import { useSearchQuery } from '../hooks/use-search-query'
import { SearchForm } from './search-form'
import { SearchResults } from './search-results'

/**
 * Two-pane search. (§7)
 *
 * The form and the results both read the URL, so there is no shared client
 * state between them — a pasted link reproduces the exact same screen, which
 * is what makes a slow query at 10 000 open rides reproducible.
 */
export function SearchPane() {
  const { query, error, hasParams } = useSearchQuery()

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
      <div className="lg:sticky lg:top-4">
        <SearchForm initial={query} />
      </div>

      <div>
        {error ? (
          <p role="alert" className="rounded-card border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            That search link is not valid: {error.issues[0]?.message ?? 'check the parameters'}.
          </p>
        ) : query ? (
          <SearchResults query={query} />
        ) : (
          <p className="rounded-card border border-dashed border-border p-6 text-sm text-fg-muted">
            {hasParams
              ? 'Complete the search to see matching rides.'
              : 'Enter where you are going and when, and rides whose route and time both overlap yours will appear here.'}
          </p>
        )}
      </div>
    </div>
  )
}

import { QueryClient, defaultShouldDehydrateQuery, isServer } from '@tanstack/react-query'
import { QUERY } from '@/config/constants'
import { isApiError } from '@/lib/api/errors'

/**
 * QueryClient defaults. (§5)
 *
 * The load-bearing default is `retry` on mutations: OFF. Booking is not
 * idempotent — retrying a POST that may have already succeeded can double-book
 * a seat. If we want retry safety later, the fix is an Idempotency-Key header
 * in the API contract, not client-side cleverness. (§6.1)
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY.DEFAULT_STALE_MS,
        gcTime: QUERY.DEFAULT_GC_MS,
        refetchOnWindowFocus: true,
        // Don't burn retries on errors that will never succeed.
        retry: (failureCount, error) => {
          if (isApiError(error) && error.status >= 400 && error.status < 500) return false
          return failureCount < 2
        },
      },
      mutations: {
        retry: false,
      },
      dehydrate: {
        // Let pending queries stream from RSC to client (§5.4).
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

/**
 * One client per request on the server; one shared client in the browser.
 * Sharing a server client across requests would leak one user's cached ride
 * data into another user's render.
 */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient()
  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}

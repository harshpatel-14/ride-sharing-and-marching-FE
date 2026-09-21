'use client'

import { useQuery } from '@tanstack/react-query'
import { LIVE } from '@/config/constants'
import { queryKeys } from '@/lib/query'
import { searchApi } from '../api/search.api'
import type { SearchQuery } from '../schemas'

/**
 * Runs the matching query. (§7)
 *
 * Note there is no client-side filtering or re-sorting anywhere in this
 * feature. The backend's ranked top-N is the answer; re-ordering it here
 * would lie to the user, and filtering it would quietly undo the indexed
 * proximity-plus-time query the whole POC is about.
 */
export function useSearchRides(query: SearchQuery | null) {
  return useQuery({
    queryKey: queryKeys.search.results(query),
    queryFn: ({ signal }) => searchApi.rides(query as SearchQuery, signal),
    enabled: query !== null,
    // Results embed seat counts, which go stale as other riders book.
    staleTime: LIVE.SEARCH_RESULTS_STALE_MS,
  })
}

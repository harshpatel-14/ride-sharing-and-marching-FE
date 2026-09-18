import { api, endpoints } from '@/lib/api'
import { searchResponseSchema, toSearchParams, type SearchQuery, type SearchResponse } from '../schemas'

export const searchApi = {
  /**
   * Proximity + time-window matching, executed as a real query in Postgres.
   * The frontend sends parameters and renders the array it gets back — it has
   * no "all rides" endpoint to fall back on. (§7, §17)
   */
  rides: async (query: SearchQuery, signal?: AbortSignal): Promise<SearchResponse> => {
    const params = toSearchParams(query)
    const raw = await api.get(`${endpoints.search.rides}?${params.toString()}`, { signal })
    return searchResponseSchema.parse(raw)
  },
}

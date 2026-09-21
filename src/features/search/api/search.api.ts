import { api, endpoints } from '@/lib/api'
import { searchResponseSchema, toSearchParams, type SearchQuery, type SearchResponse } from '../schemas'

export const searchApi = {
  /**
   * Proximity + time-window matching, executed as a real indexed query in
   * Postgres. The frontend sends parameters and renders the array it gets
   * back — there is no "all rides" endpoint to fall back on. (§7, §17)
   */
  rides: async (query: SearchQuery, signal?: AbortSignal): Promise<SearchResponse> => {
    const params = toSearchParams(query)
    const raw = await api.get(`${endpoints.rides.search}?${params.toString()}`, { signal })
    return searchResponseSchema.parse(raw)
  },
}

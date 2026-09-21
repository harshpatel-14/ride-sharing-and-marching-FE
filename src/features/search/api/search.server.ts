import 'server-only'
import { endpoints } from '@/lib/api'
import { callApi, readTokens } from '@/features/auth/server'
import { searchResponseSchema, toSearchParams, type SearchQuery, type SearchResponse } from '../schemas'

/** Server-side search for RSC prefetch. (§5.4) */
export const serverSearchApi = {
  rides: async (query: SearchQuery): Promise<SearchResponse> => {
    const { accessToken } = await readTokens()
    if (!accessToken) throw new Error('No access token; the route guard should have redirected')

    return searchResponseSchema.parse(
      await callApi('GET', endpoints.rides.search, {
        accessToken,
        query: Object.fromEntries(toSearchParams(query)),
      }),
    )
  },
}

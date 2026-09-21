import 'server-only'
import { endpoints } from '@/lib/api'
import { callApi, readTokens } from '@/features/auth/server'
import { bookingListResponseSchema } from '../schemas'

/**
 * Server-side booking reads for RSC prefetch. (§5.4)
 *
 * Kept out of the feature's main barrel: `next/headers` and `server-only`
 * must never be reachable from a Client Component's import graph.
 */
export const serverBookingsApi = {
  listMine: async () => {
    const { accessToken } = await readTokens()
    if (!accessToken) throw new Error('No access token; the route guard should have redirected')

    return bookingListResponseSchema.parse(
      await callApi('GET', endpoints.me.bookings, { accessToken }),
    )
  },
}

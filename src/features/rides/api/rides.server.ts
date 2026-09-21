import 'server-only'
import { endpoints } from '@/lib/api'
import { callApi, readTokens } from '@/features/auth/server'
import { rideListResponseSchema, rideResponseSchema, type Ride } from '../schemas'

/**
 * Server-side ride reads for RSC prefetch. (§5.4)
 *
 * Kept out of the feature's main barrel deliberately: `next/headers` and
 * `server-only` must never be reachable from a Client Component's import
 * graph. Reach these through `@/features/rides/server`.
 *
 * These cannot refresh an expired token — Server Components may not set
 * cookies — so they throw and the page redirects to /login. The BFF proxy
 * handles refresh for client-side calls.
 */
async function token(): Promise<string> {
  const { accessToken } = await readTokens()
  if (!accessToken) throw new Error('No access token; the route guard should have redirected')
  return accessToken
}

export const serverRidesApi = {
  getById: async (rideId: string): Promise<Ride> =>
    rideResponseSchema.parse(
      await callApi('GET', endpoints.rides.byId(rideId), { accessToken: await token() }),
    ).ride,

  listMine: async () =>
    rideListResponseSchema.parse(
      await callApi('GET', endpoints.me.rides, { accessToken: await token() }),
    ),
}

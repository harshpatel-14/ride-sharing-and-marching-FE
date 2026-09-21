import { api, endpoints } from '@/lib/api'
import {
  cancelRideResponseSchema,
  createRideSchema,
  rideListResponseSchema,
  rideResponseSchema,
  updateRideSchema,
  type CreateRideInput,
  type Ride,
  type UpdateRideInput,
} from '../schemas'

/**
 * Every response is parsed at the boundary. (§5.3)
 *
 * TypeScript types vanish at runtime; a backend rename would otherwise surface
 * as `Cannot read properties of undefined` three components deep instead of a
 * located, attributable error here.
 */
export const ridesApi = {
  getById: async (rideId: string): Promise<Ride> =>
    rideResponseSchema.parse(await api.get(endpoints.rides.byId(rideId))).ride,

  listMine: async (params: { limit?: number; cursor?: string; status?: string } = {}) => {
    const query: Record<string, string | number> = {}
    if (params.limit !== undefined) query['limit'] = params.limit
    if (params.cursor !== undefined) query['cursor'] = params.cursor
    if (params.status !== undefined) query['status'] = params.status

    return rideListResponseSchema.parse(await api.get(endpoints.me.rides, { query }))
  },

  create: async (input: CreateRideInput): Promise<Ride> =>
    rideResponseSchema.parse(await api.post(endpoints.rides.create, createRideSchema.parse(input)))
      .ride,

  /** Genuinely partial — omitted fields keep their current values. */
  update: async (rideId: string, input: UpdateRideInput): Promise<Ride> =>
    rideResponseSchema.parse(
      await api.patch(endpoints.rides.byId(rideId), updateRideSchema.parse(input)),
    ).ride,

  /** Cancels the ride AND every confirmed booking on it, in one transaction. */
  cancel: async (rideId: string, reason?: string) =>
    cancelRideResponseSchema.parse(
      await api.post(endpoints.rides.cancel(rideId), reason ? { reason } : undefined),
    ),

  /** Irreversible. Afterwards every mutation returns 409. */
  complete: async (rideId: string): Promise<Ride> =>
    rideResponseSchema.parse(await api.post(endpoints.rides.complete(rideId))).ride,
}

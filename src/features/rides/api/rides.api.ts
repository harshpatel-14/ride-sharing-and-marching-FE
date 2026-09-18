import { api, endpoints } from '@/lib/api'
import { createRideSchema, rideListSchema, rideSchema, type CreateRideInput, type Ride } from '../schemas'

/**
 * Every response is parsed at the boundary. (§5.3)
 *
 * TypeScript types vanish at runtime; a backend rename would otherwise surface
 * as `Cannot read properties of undefined` three components deep instead of a
 * located, attributable error here.
 */
export const ridesApi = {
  getById: async (rideId: string): Promise<Ride> =>
    rideSchema.parse(await api.get(endpoints.rides.byId(rideId))),

  listMine: async (): Promise<Ride[]> =>
    rideListSchema.parse(await api.get(endpoints.rides.mine)),

  create: async (input: CreateRideInput): Promise<Ride> =>
    rideSchema.parse(await api.post(endpoints.rides.create, createRideSchema.parse(input))),

  cancel: async (rideId: string): Promise<Ride> =>
    rideSchema.parse(await api.post(endpoints.rides.cancel(rideId))),

  complete: async (rideId: string): Promise<Ride> =>
    rideSchema.parse(await api.post(endpoints.rides.complete(rideId))),
}

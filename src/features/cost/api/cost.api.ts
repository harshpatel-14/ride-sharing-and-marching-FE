import { api, endpoints } from '@/lib/api'
import { costSplitSchema, type CostSplit } from '../schemas'

export const costApi = {
  forRide: async (rideId: string): Promise<CostSplit> =>
    costSplitSchema.parse(await api.get(endpoints.rides.costSplit(rideId))),
}

import { api, endpoints } from '@/lib/api'
import {
  bookingListResponseSchema,
  bookingResponseSchema,
  cancelBookingResponseSchema,
  rideManifestResponseSchema,
  type Booking,
} from '../schemas'

export const bookingsApi = {
  /**
   * Claims a seat. No body — the caller is the rider, and seats are always 1.
   *
   * May legitimately return 409 NO_SEATS_AVAILABLE when another rider won the
   * race for the last seat. That is an expected outcome handled by the caller,
   * not an error to retry. (§6.1, spec §3.3)
   */
  create: async (rideId: string): Promise<Booking> =>
    bookingResponseSchema.parse(await api.post(endpoints.bookings.create(rideId))).booking,

  listMine: async (params: { limit?: number; cursor?: string; status?: string } = {}) => {
    const query: Record<string, string | number> = {}
    if (params.limit !== undefined) query['limit'] = params.limit
    if (params.cursor !== undefined) query['cursor'] = params.cursor
    if (params.status !== undefined) query['status'] = params.status
    return bookingListResponseSchema.parse(await api.get(endpoints.me.bookings, { query }))
  },

  /** Driver of that ride only — anyone else, including its riders, gets 404. */
  manifest: async (rideId: string) =>
    rideManifestResponseSchema.parse(await api.get(endpoints.rides.bookings(rideId))),

  /** Callable by the rider who holds it OR the driver of the ride. */
  cancel: async (bookingId: string, reason?: string) =>
    cancelBookingResponseSchema.parse(
      await api.post(endpoints.bookings.cancel(bookingId), reason ? { reason } : undefined),
    ),
}

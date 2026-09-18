import { api, endpoints } from '@/lib/api'
import {
  bookSeatSchema,
  bookingListSchema,
  bookingWithRideSchema,
  bookingSchema,
  type BookSeatInput,
  type Booking,
  type BookingWithRide,
} from '../schemas'

export const bookingsApi = {
  /**
   * Books a seat. May legitimately return 409 when another rider won the race
   * for the last seat — that is an expected outcome, handled by the caller,
   * not an error to be retried. (§6.1, spec §3.3)
   */
  create: async (rideId: string, input: BookSeatInput): Promise<Booking> =>
    bookingSchema.parse(
      await api.post(endpoints.bookings.create(rideId), bookSeatSchema.parse(input)),
    ),

  listMine: async (): Promise<BookingWithRide[]> =>
    bookingListSchema.parse(await api.get(endpoints.bookings.mine)),

  getById: async (bookingId: string): Promise<BookingWithRide> =>
    bookingWithRideSchema.parse(await api.get(endpoints.bookings.byId(bookingId))),

  /** Seat returns to availability immediately; the split recalculates. (spec §3.4, §3.5) */
  cancel: async (bookingId: string): Promise<Booking> =>
    bookingSchema.parse(await api.post(endpoints.bookings.cancel(bookingId))),
}

import { z } from 'zod'
import { rideSchema } from '@/features/rides'
import { decimalStringSchema } from '@/lib/utils'

/**
 * There is no PENDING state: a booking either claimed a seat or does not
 * exist. The two cancellation states are kept distinct because they are
 * different events with different consequences for the rider. (§10)
 */
export const bookingStatusSchema = z.enum([
  'CONFIRMED',
  'CANCELLED_BY_RIDER',
  'CANCELLED_BY_DRIVER',
])
export type BookingStatus = z.infer<typeof bookingStatusSchema>

export const publicRiderSchema = z.object({ id: z.uuid(), fullName: z.string() })
export const riderWithContactSchema = publicRiderSchema.extend({
  phone: z.string(),
  email: z.email(),
})
export type PublicRider = z.infer<typeof publicRiderSchema>
export type RiderWithContact = z.infer<typeof riderWithContactSchema>
export type Rider = PublicRider | RiderWithContact

export const riderHasContact = (rider: Rider): rider is RiderWithContact => 'phone' in rider

export const bookingSchema = z.object({
  id: z.uuid(),
  rideId: z.uuid(),
  riderId: z.uuid(),
  status: bookingStatusSchema,
  /**
   * This rider's share as of the last recalculation. It MOVES — and it goes
   * UP when another rider cancels. Surfacing that is a product requirement:
   * a silently increasing charge is what people dispute. (§11)
   */
  seatShare: decimalStringSchema,
  /** "0.00" once cancelled. seatShare is kept as the record of what was quoted. */
  amountOwed: decimalStringSchema,
  createdAt: z.iso.datetime(),
  cancelledAt: z.iso.datetime().nullable(),
  cancellationReason: z.string().nullable(),
  ride: rideSchema.optional(),
  rider: z.union([riderWithContactSchema, publicRiderSchema]).optional(),
})
export type Booking = z.infer<typeof bookingSchema>

export const bookingResponseSchema = z.object({ booking: bookingSchema })
export const bookingListResponseSchema = z.object({
  bookings: z.array(bookingSchema),
  nextCursor: z.string().nullable(),
})
export const rideManifestResponseSchema = z.object({ bookings: z.array(bookingSchema) })
export const cancelBookingResponseSchema = z.object({
  booking: bookingSchema,
  seatsAvailable: z.number().int().min(0),
})

export const isBookingActive = (status: BookingStatus) => status === 'CONFIRMED'
export const isCancelledByDriver = (status: BookingStatus) => status === 'CANCELLED_BY_DRIVER'

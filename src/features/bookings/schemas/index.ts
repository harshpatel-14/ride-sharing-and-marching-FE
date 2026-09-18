import { z } from 'zod'
import { contactSchema, rideSchema } from '@/features/rides'

/**
 * Cancellation cause is part of the status, not a separate flag. (§10)
 *
 * CANCELLED_BY_DRIVER and CANCELLED_BY_RIDER are different events with
 * potentially different refund and reputation handling later; collapsing them
 * into one CANCELLED is a decision that is expensive to reverse.
 */
export const bookingStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'CANCELLED_BY_RIDER',
  'CANCELLED_BY_DRIVER',
  'COMPLETED',
])
export type BookingStatus = z.infer<typeof bookingStatusSchema>

export const bookingSchema = z.object({
  id: z.uuid(),
  rideId: z.uuid(),
  riderId: z.uuid(),
  riderName: z.string(),
  seats: z.number().int().min(1),
  status: bookingStatusSchema,
  /**
   * Present only while the booking is CONFIRMED. When a driver cancels the
   * ride, the server stops returning this and the panel disappears on the next
   * fetch — revocation needs no client-side cleanup because visibility was
   * never client-owned. (§9, §10)
   */
  contact: contactSchema.nullable(),
  /** This rider's share, computed by the server. (§11) */
  shareMinor: z.number().int().min(0),
  currency: z.string().length(3).default('INR'),
  createdAt: z.iso.datetime(),
  cancelledAt: z.iso.datetime().nullable(),
})
export type Booking = z.infer<typeof bookingSchema>

/** My-bookings list embeds the ride so the card can render without an N+1. */
export const bookingWithRideSchema = bookingSchema.extend({ ride: rideSchema })
export type BookingWithRide = z.infer<typeof bookingWithRideSchema>

export const bookingListSchema = z.array(bookingWithRideSchema)

export const bookSeatSchema = z.object({
  seats: z.number().int().min(1).max(8).default(1),
})
export type BookSeatInput = z.input<typeof bookSeatSchema>

export const isBookingActive = (status: BookingStatus) =>
  status === 'PENDING' || status === 'CONFIRMED'

export const isCancelledByDriver = (status: BookingStatus) => status === 'CANCELLED_BY_DRIVER'

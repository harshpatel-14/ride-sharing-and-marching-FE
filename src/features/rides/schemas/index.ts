import { z } from 'zod'
import { placeSchema } from '@/lib/geo'
import { RIDE } from '@/config/constants'

export const rideStatusSchema = z.enum(['OPEN', 'FULL', 'CANCELLED', 'COMPLETED'])
export type RideStatus = z.infer<typeof rideStatusSchema>

/**
 * Contact details. (§9, spec §3.7)
 *
 * This shape appears in a ride payload ONLY when the caller holds a confirmed
 * booking on it. The server decides; the frontend has no `canViewContact`
 * boolean, because a second implementation of an authorization rule drifts
 * from the first.
 */
export const contactSchema = z.object({
  name: z.string(),
  phone: z.string(),
})
export type Contact = z.infer<typeof contactSchema>

export const rideSchema = z.object({
  id: z.uuid(),
  driverId: z.uuid(),
  driverName: z.string(),
  origin: placeSchema,
  destination: placeSchema,
  departureAt: z.iso.datetime(),
  seatsTotal: z.number().int().min(RIDE.MIN_SEATS).max(RIDE.MAX_SEATS),
  /** Server-owned. The frontend NEVER decrements this locally. (§0.1, §6.1) */
  seatsAvailable: z.number().int().min(0),
  status: rideStatusSchema,
  /** Integer minor units (paise). Never a float. (§11) */
  estimatedCostMinor: z.number().int().min(0),
  currency: z.string().length(3).default('INR'),
  /** Null unless the caller has a confirmed booking. Absence is the security control. */
  driverContact: contactSchema.nullable(),
  createdAt: z.iso.datetime(),
})
export type Ride = z.infer<typeof rideSchema>

export const rideListSchema = z.array(rideSchema)

/**
 * Ride creation input. These rules mirror the backend's validators — they do
 * not replace them. Bad input is rejected server-side before it reaches
 * business logic (spec §6); this schema exists so the rider finds out in the
 * form instead of after a round trip.
 */
export const createRideSchema = z.object({
  origin: placeSchema,
  destination: placeSchema,
  departureAt: z.iso.datetime(),
  seatsTotal: z
    .number()
    .int()
    .min(RIDE.MIN_SEATS, `At least ${RIDE.MIN_SEATS} seat`)
    .max(RIDE.MAX_SEATS, `At most ${RIDE.MAX_SEATS} seats`),
  estimatedCostMinor: z.number().int().min(0, 'Cost cannot be negative'),
  currency: z.string().length(3).default('INR'),
})
  .refine(
    (v) => new Date(v.departureAt).getTime() > Date.now() + RIDE.MIN_LEAD_TIME_MINUTES * 60_000,
    { message: 'Departure must be at least 15 minutes from now', path: ['departureAt'] },
  )
  .refine(
    (v) => v.origin.coords.lat !== v.destination.coords.lat || v.origin.coords.lng !== v.destination.coords.lng,
    { message: 'Origin and destination must differ', path: ['destination'] },
  )
export type CreateRideInput = z.input<typeof createRideSchema>

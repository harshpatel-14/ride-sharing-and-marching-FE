import { z } from 'zod'
import { RIDE } from '@/config/constants'
import { decimalStringSchema } from '@/lib/utils'

/** OPEN · CANCELLED · COMPLETED. There is no FULL — read `seatsAvailable`. */
export const rideStatusSchema = z.enum(['OPEN', 'CANCELLED', 'COMPLETED'])
export type RideStatus = z.infer<typeof rideStatusSchema>

export const placeSchema = z.object({
  label: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})
export type Place = z.infer<typeof placeSchema>

/**
 * The driver, in its two shapes. (§9, spec §3.7)
 *
 * `phone` and `email` are present only when the caller is the driver or holds
 * a confirmed booking. The backend does not fetch those columns otherwise, so
 * their absence is the security control — there is nothing to filter on the
 * client and nothing for a client-side rule to get wrong.
 */
export const publicDriverSchema = z.object({ id: z.uuid(), fullName: z.string() })
export const driverWithContactSchema = publicDriverSchema.extend({
  phone: z.string(),
  email: z.email(),
})
export const driverSchema = z.union([driverWithContactSchema, publicDriverSchema])

export type PublicDriver = z.infer<typeof publicDriverSchema>
export type DriverWithContact = z.infer<typeof driverWithContactSchema>
export type Driver = PublicDriver | DriverWithContact

/**
 * The type guard that makes contact visibility explicit at every call site.
 * Prefer this to `driver.phone && …` — the narrowing states the rule.
 */
export const hasContact = (driver: Driver): driver is DriverWithContact => 'phone' in driver

export const rideSchema = z.object({
  id: z.uuid(),
  origin: placeSchema,
  destination: placeSchema,
  departureAt: z.iso.datetime(),
  /** Widens the window this ride is matched against. 0–720. */
  flexMinutes: z.number().int().min(0),
  /** `departureAt ± flexMinutes`, computed by the database. What search matches. */
  departureWindow: z.object({ from: z.iso.datetime(), to: z.iso.datetime() }),
  seatsTotal: z.number().int(),
  seatsTaken: z.number().int().min(0),
  /** Advisory until you actually book — the booking call is the authority. */
  seatsAvailable: z.number().int().min(0),
  /** Decimal STRING for the whole ride, not per person. Never parse to a number. */
  estimatedCost: decimalStringSchema,
  status: rideStatusSchema,
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  driver: driverSchema,
  /** Saves comparing ids to decide whether to show driver controls. */
  isOwner: z.boolean(),
})
export type Ride = z.infer<typeof rideSchema>

export const rideResponseSchema = z.object({ ride: rideSchema })
export const rideListResponseSchema = z.object({
  rides: z.array(rideSchema),
  nextCursor: z.string().nullable(),
})
export const cancelRideResponseSchema = z.object({
  ride: rideSchema,
  bookingsCancelled: z.number().int().min(0),
})

/**
 * Create payload. Flat, and coordinates are separate scalars — this mirrors
 * `POST /rides` exactly rather than inventing a nested shape the API would
 * have to be translated into twice.
 */
export const createRideSchema = z.object({
  originLabel: z.string().trim().min(2).max(200),
  originLat: z.number().min(-90).max(90),
  originLng: z.number().min(-180).max(180),
  destLabel: z.string().trim().min(2).max(200),
  destLat: z.number().min(-90).max(90),
  destLng: z.number().min(-180).max(180),
  departureAt: z.iso.datetime(),
  flexMinutes: z.number().int().min(0).max(RIDE.MAX_FLEX_MINUTES),
  seatsTotal: z.number().int().min(RIDE.MIN_SEATS).max(RIDE.MAX_SEATS),
  /** Sent as a decimal string so no float ever touches the amount. */
  estimatedCost: decimalStringSchema,
})
export type CreateRideInput = z.infer<typeof createRideSchema>

/** PATCH is genuinely partial — omitted fields keep their current values. */
export const updateRideSchema = createRideSchema.partial()
export type UpdateRideInput = z.infer<typeof updateRideSchema>

export const isRideTerminal = (ride: Pick<Ride, 'status'>): boolean =>
  ride.status === 'COMPLETED' || ride.status === 'CANCELLED'

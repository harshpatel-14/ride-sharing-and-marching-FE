import { z } from 'zod'
import { RIDE } from '@/config/constants'
import { toWireAmount } from '@/lib/utils'
import type { CreateRideInput } from './index'

/**
 * Form-shaped schema for posting a ride.
 *
 * Separate from `createRideSchema`, not a duplicate of it, because the form
 * and the wire disagree in two places:
 *
 *   - `<input type="datetime-local">` yields "2026-09-25T14:30" in the user's
 *     local zone; the API takes an ISO-8601 instant.
 *   - The cost input is free text; the wire wants a normalised decimal string.
 *
 * `toCreateRideInput` is the single place that translation happens. The wire
 * schema validates again on the way out, and the API validates independently
 * of both (spec §6) — this layer exists so the user finds out in the form
 * rather than after a round trip.
 */

const coordinate = (axis: 'latitude' | 'longitude') =>
  z
    .number({ message: `Enter a ${axis}` })
    .refine((n) => !Number.isNaN(n), { message: `Enter a ${axis}` })
    .refine(
      (n) => (axis === 'latitude' ? n >= -90 && n <= 90 : n >= -180 && n <= 180),
      {
        message:
          axis === 'latitude'
            ? 'Latitude must be between -90 and 90'
            : 'Longitude must be between -180 and 180',
      },
    )

const placeFieldSchema = z.object({
  label: z.string().trim().min(2, 'Enter a place name').max(200, 'Keep it under 200 characters'),
  coords: z.object({ lat: coordinate('latitude'), lng: coordinate('longitude') }),
})

export const rideFormSchema = z
  .object({
    origin: placeFieldSchema,
    destination: placeFieldSchema,
    /** Local wall-clock string from <input type="datetime-local">. */
    departureLocal: z.string().min(1, 'Choose a departure time'),
    flexMinutes: z.coerce
      .number({ message: 'Enter a flexibility in minutes' })
      .int('Use whole minutes')
      .min(0, 'Cannot be negative')
      .max(RIDE.MAX_FLEX_MINUTES, `At most ${RIDE.MAX_FLEX_MINUTES} minutes`),
    seatsTotal: z.coerce
      .number({ message: 'Enter a seat count' })
      .int('Seats must be a whole number')
      .min(RIDE.MIN_SEATS, `At least ${RIDE.MIN_SEATS} seat`)
      .max(RIDE.MAX_SEATS, `At most ${RIDE.MAX_SEATS} seats`),
    /** Free text, e.g. "300" or "300.50". Normalised, never parsed to a number. */
    estimatedCost: z.string().min(1, 'Enter an estimated cost'),
  })
  .refine((v) => toWireAmount(v.estimatedCost) !== null, {
    message: 'Enter an amount like 300 or 300.50',
    path: ['estimatedCost'],
  })
  .refine((v) => !Number.isNaN(Date.parse(v.departureLocal)), {
    message: 'Choose a valid departure time',
    path: ['departureLocal'],
  })
  // spec §6 — a ride departing in the past is rejected before business logic.
  .refine(
    (v) =>
      Number.isNaN(Date.parse(v.departureLocal)) ||
      new Date(v.departureLocal).getTime() > Date.now() + RIDE.MIN_LEAD_TIME_MINUTES * 60_000,
    {
      message: `Departure must be at least ${RIDE.MIN_LEAD_TIME_MINUTES} minutes from now`,
      path: ['departureLocal'],
    },
  )
  .refine(
    (v) =>
      v.origin.coords.lat !== v.destination.coords.lat ||
      v.origin.coords.lng !== v.destination.coords.lng,
    { message: 'Origin and destination must differ', path: ['destination', 'label'] },
  )

export type RideFormValues = z.input<typeof rideFormSchema>
export type RideFormParsed = z.output<typeof rideFormSchema>

/** The single point where form representation becomes wire representation. */
export function toCreateRideInput(values: RideFormParsed): CreateRideInput {
  const estimatedCost = toWireAmount(values.estimatedCost)
  if (estimatedCost === null) {
    throw new Error('toCreateRideInput called with an unvalidated cost')
  }

  return {
    originLabel: values.origin.label,
    originLat: values.origin.coords.lat,
    originLng: values.origin.coords.lng,
    destLabel: values.destination.label,
    destLat: values.destination.coords.lat,
    destLng: values.destination.coords.lng,
    departureAt: new Date(values.departureLocal).toISOString(),
    flexMinutes: values.flexMinutes,
    seatsTotal: values.seatsTotal,
    estimatedCost,
  }
}

/** Minimum for the datetime-local input, so the picker discourages the past. */
export function minDepartureLocal(now: Date = new Date()): string {
  const earliest = new Date(now.getTime() + RIDE.MIN_LEAD_TIME_MINUTES * 60_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${earliest.getFullYear()}-${pad(earliest.getMonth() + 1)}-${pad(earliest.getDate())}T${pad(earliest.getHours())}:${pad(earliest.getMinutes())}`
}

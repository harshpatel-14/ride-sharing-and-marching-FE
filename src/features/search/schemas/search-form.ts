import { z } from 'zod'
import { RIDE, SEARCH } from '@/config/constants'
import type { SearchQuery } from './index'

/**
 * Form-shaped schema for the search form.
 *
 * Same split as the ride form: `datetime-local` gives a local wall clock, the
 * API wants ISO instants. `toSearchQuery` is the single translation point.
 */
const coordinate = (axis: 'latitude' | 'longitude') =>
  z
    .number({ message: `Enter a ${axis}` })
    .refine((n) => !Number.isNaN(n), { message: `Enter a ${axis}` })
    .refine((n) => (axis === 'latitude' ? n >= -90 && n <= 90 : n >= -180 && n <= 180), {
      message: `Enter a valid ${axis}`,
    })

const placeFieldSchema = z.object({
  label: z.string().trim().min(1, 'Choose a place'),
  coords: z.object({ lat: coordinate('latitude'), lng: coordinate('longitude') }),
})

export const searchFormSchema = z
  .object({
    origin: placeFieldSchema,
    destination: placeFieldSchema,
    departAfterLocal: z.string().min(1, 'Choose the earliest departure'),
    departBeforeLocal: z.string().min(1, 'Choose the latest departure'),
    radiusMeters: z.coerce
      .number()
      .int()
      .min(SEARCH.MIN_RADIUS_METERS, `At least ${SEARCH.MIN_RADIUS_METERS} m`)
      .max(SEARCH.MAX_RADIUS_METERS, `At most ${SEARCH.MAX_RADIUS_METERS / 1000} km`),
    seats: z.coerce.number().int().min(RIDE.MIN_SEATS).max(RIDE.MAX_SEATS),
  })
  .refine((v) => !Number.isNaN(Date.parse(v.departAfterLocal)) && !Number.isNaN(Date.parse(v.departBeforeLocal)), {
    message: 'Choose valid times',
    path: ['departBeforeLocal'],
  })
  .refine((v) => new Date(v.departAfterLocal) < new Date(v.departBeforeLocal), {
    message: 'The window must start before it ends',
    path: ['departBeforeLocal'],
  })
  // The API rejects a wider window; catching it here saves a round trip.
  .refine(
    (v) =>
      new Date(v.departBeforeLocal).getTime() - new Date(v.departAfterLocal).getTime() <=
      SEARCH.MAX_WINDOW_HOURS * 3_600_000,
    {
      message: `The window may not exceed ${SEARCH.MAX_WINDOW_HOURS} hours`,
      path: ['departBeforeLocal'],
    },
  )
  .refine(
    (v) =>
      v.origin.coords.lat !== v.destination.coords.lat ||
      v.origin.coords.lng !== v.destination.coords.lng,
    { message: 'Origin and destination must differ', path: ['destination', 'label'] },
  )

export type SearchFormValues = z.input<typeof searchFormSchema>
export type SearchFormParsed = z.output<typeof searchFormSchema>

export function toSearchQuery(values: SearchFormParsed): SearchQuery {
  return {
    originLat: values.origin.coords.lat,
    originLng: values.origin.coords.lng,
    destLat: values.destination.coords.lat,
    destLng: values.destination.coords.lng,
    departAfter: new Date(values.departAfterLocal).toISOString(),
    departBefore: new Date(values.departBeforeLocal).toISOString(),
    radiusMeters: values.radiusMeters,
    seats: values.seats,
    limit: SEARCH.PAGE_SIZE,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Repopulates the form from a shared URL, so a link round-trips. */
export function fromSearchQuery(query: SearchQuery): SearchFormValues {
  return {
    origin: { label: '', coords: { lat: query.originLat, lng: query.originLng } },
    destination: { label: '', coords: { lat: query.destLat, lng: query.destLng } },
    departAfterLocal: toLocalInput(new Date(query.departAfter)),
    departBeforeLocal: toLocalInput(new Date(query.departBefore)),
    radiusMeters: query.radiusMeters,
    seats: query.seats,
  }
}

/** Sensible starting window: from now to four hours out. */
export function defaultSearchFormValues(now: Date = new Date()): SearchFormValues {
  return {
    origin: { label: '', coords: { lat: Number.NaN, lng: Number.NaN } },
    destination: { label: '', coords: { lat: Number.NaN, lng: Number.NaN } },
    departAfterLocal: toLocalInput(now),
    departBeforeLocal: toLocalInput(new Date(now.getTime() + 4 * 3_600_000)),
    radiusMeters: SEARCH.DEFAULT_RADIUS_METERS,
    seats: 1,
  }
}

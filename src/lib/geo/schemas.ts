import { z } from 'zod'

/** Wire representation of a point. Shared by rides and search. */
export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export const placeSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  coords: latLngSchema,
})

export type LatLngInput = z.infer<typeof latLngSchema>
export type PlaceInput = z.infer<typeof placeSchema>

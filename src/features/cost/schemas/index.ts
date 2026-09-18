import { z } from 'zod'

/**
 * The cost split. (§11, spec §3.5)
 *
 * Every field here is computed by the backend. There is deliberately no
 * arithmetic in this feature: ₹100 split three ways leaves a remainder that
 * must be allocated identically to whatever the audit trail records, and a
 * client-side figure differing by one paisa makes that trail worthless as
 * evidence in the dispute it exists to settle.
 */
export const costSplitSchema = z.object({
  rideId: z.uuid(),
  totalMinor: z.number().int().min(0),
  confirmedRiderCount: z.number().int().min(0),
  /** Base share; remainder allocation is the server's, and may differ per rider. */
  perRiderMinor: z.number().int().min(0),
  /** This caller's share. Null when the caller has no confirmed booking. */
  yourShareMinor: z.number().int().min(0).nullable(),
  currency: z.string().length(3).default('INR'),
  /** Surfaced in the UI so a rider sees WHY their share moved. (§11) */
  recalculatedAt: z.iso.datetime(),
})
export type CostSplit = z.infer<typeof costSplitSchema>

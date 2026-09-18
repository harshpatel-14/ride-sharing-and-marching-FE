import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { invalidateAfter } from './invalidation'
import { queryKeys } from './keys'

function trackedClient() {
  const qc = new QueryClient()
  const spy = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue()
  const invalidated = () => spy.mock.calls.map(([arg]) => JSON.stringify(arg?.queryKey))
  return { qc, invalidated }
}

const has = (calls: string[], key: readonly unknown[]) => calls.includes(JSON.stringify(key))

describe('invalidation matrix (§5.2)', () => {
  /**
   * Search results embed seat counts. A seat-affecting mutation that leaves
   * them cached reproduces the exact problem this product exists to fix.
   */
  it('invalidates search results after booking a seat', async () => {
    const { qc, invalidated } = trackedClient()
    await invalidateAfter.bookSeat(qc, 'ride-1')
    expect(has(invalidated(), queryKeys.search.all)).toBe(true)
  })

  it('invalidates ride detail, bookings and cost split after booking', async () => {
    const { qc, invalidated } = trackedClient()
    await invalidateAfter.bookSeat(qc, 'ride-1')
    const calls = invalidated()
    expect(has(calls, queryKeys.rides.detail('ride-1'))).toBe(true)
    expect(has(calls, queryKeys.rides.costSplit('ride-1'))).toBe(true)
    expect(has(calls, queryKeys.bookings.mine())).toBe(true)
  })

  // spec §3.4 — no stale "still booked" window; §3.5 — the split recalculates.
  it('invalidates the same set on cancellation as on booking', async () => {
    const { qc, invalidated } = trackedClient()
    await invalidateAfter.cancelBooking(qc, 'ride-1', 'booking-1')
    const calls = invalidated()
    for (const key of [
      queryKeys.rides.detail('ride-1'),
      queryKeys.rides.costSplit('ride-1'),
      queryKeys.search.all,
      queryKeys.bookings.mine(),
    ]) {
      expect(has(calls, key)).toBe(true)
    }
  })

  it('invalidates riders’ bookings when a driver cancels the whole ride', async () => {
    const { qc, invalidated } = trackedClient()
    await invalidateAfter.cancelRide(qc, 'ride-1')
    expect(has(invalidated(), queryKeys.bookings.mine())).toBe(true)
  })

  it('invalidates search after a ride is completed or created', async () => {
    const { qc, invalidated } = trackedClient()
    await invalidateAfter.completeRide(qc, 'ride-1')
    await invalidateAfter.createRide(qc)
    expect(invalidated().filter((k) => k === JSON.stringify(queryKeys.search.all))).toHaveLength(2)
  })
})

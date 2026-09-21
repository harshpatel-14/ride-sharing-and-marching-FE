import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { makeRide, scenarios } from '@/mocks'
import { server } from '@/mocks/server'
import { queryKeys } from '@/lib/query'
import { toastError } from '@/test/mocks-next'
import { useCancelRide, useCompleteRide } from './use-ride-mutations'

const RIDE_ID = '00000000-0000-4000-8000-000000000100'

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidated: string[] = []
  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(async (filters) => {
    invalidated.push(JSON.stringify(filters?.queryKey))
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const saw = (key: readonly unknown[]) => invalidated.includes(JSON.stringify(key))
  return { wrapper, saw, invalidated }
}

describe('useCancelRide', () => {
  /**
   * Cancelling a ride cancels every booking on it, so a rider's list and any
   * cached search results are both stale the moment it succeeds. Missing
   * either one shows a seat that no longer exists. (§5.2, spec §3.4)
   */
  it('invalidates search results and riders’ bookings, not just the ride', async () => {
    const { wrapper, saw } = setup()
    const { result } = renderHook(() => useCancelRide(RIDE_ID), { wrapper })

    await result.current.mutateAsync(undefined)

    await waitFor(() => expect(saw(queryKeys.search.all)).toBe(true))
    expect(saw(queryKeys.bookings.mine())).toBe(true)
    expect(saw(queryKeys.rides.detail(RIDE_ID))).toBe(true)
    expect(saw(queryKeys.rides.mine())).toBe(true)
  })

  /**
   * A ride that went terminal while the page was open is stale state, not a
   * crash. The API signals it with 409 RIDE_COMPLETED_IMMUTABLE (there is no
   * 410 in this contract), and the view must refresh to show the lock.
   */
  it('refreshes and explains when the ride is already completed', async () => {
    server.use(scenarios.rideCompleted('cancel'))
    const { wrapper, saw } = setup()
    const { result } = renderHook(() => useCancelRide(RIDE_ID), { wrapper })

    await expect(result.current.mutateAsync(undefined)).rejects.toThrow()

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/this ride has finished/i)),
    )
    expect(saw(queryKeys.rides.detail(RIDE_ID))).toBe(true)
  })

  it('does not retry a cancel that failed on the network (§6.1)', async () => {
    let calls = 0
    server.use(
      http.post('*/rides/:rideId/cancel', () => {
        calls += 1
        return HttpResponse.error()
      }),
    )
    const { wrapper } = setup()
    const { result } = renderHook(() => useCancelRide(RIDE_ID), { wrapper })

    await expect(result.current.mutateAsync(undefined)).rejects.toThrow()
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(calls).toBe(1)
  })
})

describe('useCompleteRide', () => {
  it('invalidates the ride and search once a ride is locked (spec §3.6)', async () => {
    server.use(
      http.post('*/rides/:rideId/complete', () =>
        HttpResponse.json({ ride: makeRide({ id: RIDE_ID, status: 'COMPLETED', isOwner: true }) }),
      ),
    )
    const { wrapper, saw } = setup()
    const { result } = renderHook(() => useCompleteRide(RIDE_ID), { wrapper })

    await result.current.mutateAsync()

    await waitFor(() => expect(saw(queryKeys.rides.detail(RIDE_ID))).toBe(true))
    expect(saw(queryKeys.search.all)).toBe(true)
  })
})

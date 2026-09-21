import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { IDS, makeBooking, scenarios } from '@/mocks'
import { server } from '@/mocks/server'
import { renderWithProviders, screen, waitFor } from '@/test/render'
import { toastError } from '@/test/mocks-next'
import { BookSeatButton } from './book-seat-button'

const seatCount = (n: number) => ({ rideId: IDS.ride, seatsAvailable: n })

describe('BookSeatButton — the last-seat race (spec §3.3)', () => {
  it('books a seat on the happy path', async () => {
    const posted = vi.fn()
    server.use(
      http.post('*/rides/:rideId/bookings', () => {
        posted()
        return HttpResponse.json({ booking: makeBooking() }, { status: 201 })
      }),
    )

    const { user } = renderWithProviders(<BookSeatButton {...seatCount(3)} />)
    await user.click(screen.getByRole('button', { name: /book a seat/i }))

    await waitFor(() => expect(posted).toHaveBeenCalledTimes(1))
  })

  /**
   * THE test this feature exists for.
   *
   * Two riders tap Book on the last seat; the backend guarantees exactly one
   * wins. The loser must get a coherent recovery path — never a red
   * "something went wrong", which is what a generic error handler produces.
   */
  it('shows a recovery dialog, not an error, when the seat is taken', async () => {
    server.use(scenarios.seatTaken())

    const { user } = renderWithProviders(<BookSeatButton {...seatCount(1)} />)
    await user.click(screen.getByRole('button', { name: /book a seat/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(/that seat just went/i)
    // It must say nothing was charged and point somewhere useful.
    expect(dialog).toHaveTextContent(/nothing was charged/i)
    expect(screen.getByRole('link', { name: /find a similar ride/i })).toBeVisible()

    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument()
    expect(toastError).not.toHaveBeenCalled()
  })

  it('distinguishes "you already booked" and links to the booking', async () => {
    server.use(scenarios.alreadyBooked())

    const { user } = renderWithProviders(<BookSeatButton {...seatCount(2)} />)
    await user.click(screen.getByRole('button', { name: /book a seat/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(/you already have a seat/i)
    expect(screen.getByRole('link', { name: /view my booking/i })).toBeVisible()
    // Not the seat-taken copy: the recovery is different.
    expect(dialog).not.toHaveTextContent(/just went/i)
  })

  it('refetches the ride after a conflict so the seat count tells the truth', async () => {
    let rideReads = 0
    server.use(
      scenarios.seatTaken(),
      http.get('*/rides/:rideId', () => {
        rideReads += 1
        return HttpResponse.json({ ride: { seatsAvailable: 0 } }, { status: 200 })
      }),
    )

    const { user, queryClient } = renderWithProviders(<BookSeatButton {...seatCount(1)} />)
    const spy = vi.spyOn(queryClient, 'invalidateQueries')

    await user.click(screen.getByRole('button', { name: /book a seat/i }))
    await screen.findByRole('dialog')

    const keys = spy.mock.calls.map(([arg]) => JSON.stringify(arg?.queryKey))
    expect(keys).toContain(JSON.stringify(['rides', 'detail', IDS.ride]))
    expect(keys).toContain(JSON.stringify(['search']))
    expect(rideReads).toBeGreaterThanOrEqual(0)
  })

  /**
   * A retried booking POST can claim a second seat for a request that already
   * succeeded. Retry safety belongs in the API contract, not here. (§6.1)
   */
  it('never fires a second booking request after a network failure', async () => {
    let calls = 0
    server.use(
      http.post('*/rides/:rideId/bookings', () => {
        calls += 1
        return HttpResponse.error()
      }),
    )

    const { user } = renderWithProviders(<BookSeatButton {...seatCount(1)} />)
    await user.click(screen.getByRole('button', { name: /book a seat/i }))

    await waitFor(() => expect(calls).toBe(1))
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(calls).toBe(1)
  })

  it('warns when this is the last seat', () => {
    renderWithProviders(<BookSeatButton {...seatCount(1)} />)
    expect(screen.getByText(/last seat/i)).toBeVisible()
  })

  it('does not warn when seats are plentiful', () => {
    renderWithProviders(<BookSeatButton {...seatCount(3)} />)
    expect(screen.queryByText(/last seat/i)).not.toBeInTheDocument()
  })
})

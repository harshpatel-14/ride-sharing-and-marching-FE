import { describe, expect, it } from 'vitest'
import { makeBooking, makeDriverCancelledBooking, makeRide } from '@/mocks'
import { renderWithProviders, screen } from '@/test/render'
import { BookingCard } from './booking-card'

describe('BookingCard — a driver-cancelled booking (§10, spec §3.4)', () => {
  /**
   * The spec asks us to decide and document what a rider sees when the driver
   * cancels. This is that decision: a persistent banner with the reason, an
   * explicit "you owe nothing", and a route forward.
   */
  it('explains the cancellation, names the reason, and offers a way forward', () => {
    renderWithProviders(<BookingCard booking={makeDriverCancelledBooking()} />)

    // Scoped to the banner: the status badge also reads "Driver cancelled",
    // and matching that instead would pass even with the banner removed.
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent(/driver cancelled this ride/i)
    expect(banner).toHaveTextContent(/car trouble/i)
    expect(banner).toHaveTextContent(/owe nothing/i)
    expect(screen.getByRole('link', { name: /find another ride/i })).toBeVisible()
  })

  /**
   * seatShare and amountOwed must both be visible and must NOT be collapsed.
   * "Was quoted 100, then the driver cancelled" has to stay distinguishable
   * from "paid 100" — that distinction is the whole point of keeping both.
   */
  it('keeps the quoted share visible while showing nothing owed', () => {
    renderWithProviders(<BookingCard booking={makeDriverCancelledBooking()} />)

    const quoted = screen.getByText(/quoted share/i)
    // The <dd> that follows the "Quoted share" <dt>.
    expect(quoted.nextElementSibling).toHaveTextContent('₹100.00')

    const owed = screen.getByText(/^owed$/i)
    expect(owed.nextElementSibling).toHaveTextContent('₹0.00')
  })

  it('does not offer to cancel an already-cancelled booking', () => {
    renderWithProviders(<BookingCard booking={makeDriverCancelledBooking()} />)
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument()
  })
})

describe('BookingCard — a confirmed booking', () => {
  const confirmed = makeBooking({ ride: makeRide(), seatShare: '160.00', amountOwed: '160.00' })

  it('shows the share and lets the rider cancel', () => {
    renderWithProviders(<BookingCard booking={confirmed} />)

    // ^your share$ so the explanatory paragraph below does not also match.
    const share = screen.getByText(/^your share$/i)
    expect(share.nextElementSibling).toHaveTextContent('₹160.00')
    expect(screen.getByRole('button', { name: /cancel booking/i })).toBeVisible()
  })

  /**
   * A silently increasing charge is what people dispute, so the UI says up
   * front that the share moves when others cancel.
   */
  it('warns that the share goes up if another rider cancels (spec §3.5)', () => {
    renderWithProviders(<BookingCard booking={confirmed} />)
    expect(screen.getByText(/goes up if someone else cancels/i)).toBeVisible()
  })

  it('renders money from the decimal string without touching a float (§11)', () => {
    const awkward = makeBooking({ ride: makeRide(), seatShare: '1200.55', amountOwed: '1200.55' })
    renderWithProviders(<BookingCard booking={awkward} />)
    expect(screen.getAllByText(/1,200\.55/).length).toBeGreaterThan(0)
  })
})

describe('CancelBookingDialog', () => {
  it('warns that cancelling raises everyone else’s share', async () => {
    const { user } = renderWithProviders(
      <BookingCard booking={makeBooking({ ride: makeRide() })} />,
    )

    await user.click(screen.getByRole('button', { name: /cancel booking/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(/seat becomes available again immediately/i)
    expect(dialog).toHaveTextContent(/each of them will pay more/i)
  })
})

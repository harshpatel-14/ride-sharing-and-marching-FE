import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { IDS, makeDriverWithContact, makeRide } from '@/mocks'
import { server } from '@/mocks/server'
import { renderWithProviders, screen, waitFor } from '@/test/render'
import type { Ride } from '../schemas'
import { RideDetail } from './ride-detail'

const past = new Date(Date.now() - 3_600_000).toISOString()

function serveRide(overrides: Partial<Ride> = {}) {
  const ride = makeRide({ id: IDS.ride, ...overrides })
  server.use(http.get('*/rides/:rideId', () => HttpResponse.json({ ride })))
  return ride
}

describe('RideDetail — contact visibility (§9, spec §3.7)', () => {
  it('shows no contact details when the driver came back public', async () => {
    serveRide()
    renderWithProviders(<RideDetail rideId={IDS.ride} />)

    await screen.findByText(/Prahlad Nagar/)
    expect(screen.queryByText(/driver contact/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/\+91/)).not.toBeInTheDocument()
  })

  it('shows contact details when the API sent them', async () => {
    serveRide({ driver: makeDriverWithContact() })
    renderWithProviders(<RideDetail rideId={IDS.ride} />)

    expect(await screen.findByText(/driver contact/i)).toBeVisible()
    expect(screen.getByText('+91 98111 00001')).toBeVisible()
    expect(screen.getByText('asha@example.com')).toBeVisible()
  })
})

describe('RideDetail — the completed lock (§10, spec §3.6)', () => {
  it('renders a completed ride read-only with no destructive actions', async () => {
    serveRide({ status: 'COMPLETED', completedAt: past, isOwner: true, departureAt: past })
    renderWithProviders(<RideDetail rideId={IDS.ride} />)

    expect(await screen.findByText(/this ride is completed/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: /cancel ride/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark complete/i })).not.toBeInTheDocument()
  })

  it('explains a cancelled ride rather than silently hiding its actions', async () => {
    serveRide({ status: 'CANCELLED', cancelledAt: past, isOwner: true })
    renderWithProviders(<RideDetail rideId={IDS.ride} />)

    expect(await screen.findByText(/this ride was cancelled/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: /cancel ride/i })).not.toBeInTheDocument()
  })
})

describe('RideDetail — capability gating (spec §6)', () => {
  it('offers the driver cancel and complete, but not a rider', async () => {
    serveRide({ isOwner: true })
    const { unmount } = renderWithProviders(<RideDetail rideId={IDS.ride} />)
    expect(await screen.findByRole('button', { name: /cancel ride/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /mark complete/i })).toBeVisible()
    unmount()

    serveRide({ isOwner: false })
    renderWithProviders(<RideDetail rideId={IDS.ride} />)
    await screen.findByText(/Prahlad Nagar/)
    expect(screen.queryByRole('button', { name: /cancel ride/i })).not.toBeInTheDocument()
  })

  it('tells the owner they are driving rather than naming them as the driver', async () => {
    serveRide({ isOwner: true })
    renderWithProviders(<RideDetail rideId={IDS.ride} />)
    expect(await screen.findByText(/you are driving/i)).toBeVisible()
  })
})

describe('RideDetail — seat count is server-owned (§0.1, §6.1)', () => {
  it('renders the seat count exactly as received', async () => {
    serveRide({ seatsTotal: 3, seatsTaken: 0, seatsAvailable: 3 })
    renderWithProviders(<RideDetail rideId={IDS.ride} />)
    expect(await screen.findByText('3 of 3 seats free')).toBeVisible()
  })

  it('calls out the last seat', async () => {
    serveRide({ seatsTotal: 3, seatsTaken: 2, seatsAvailable: 1 })
    renderWithProviders(<RideDetail rideId={IDS.ride} />)
    expect(await screen.findByText('1 of 3 seats free')).toBeVisible()
  })

  it('says so when there are none left', async () => {
    serveRide({ seatsTotal: 3, seatsTaken: 3, seatsAvailable: 0 })
    renderWithProviders(<RideDetail rideId={IDS.ride} />)
    expect(await screen.findByText('No seats left')).toBeVisible()
  })
})

describe('RideDetail — money stays a string (§11)', () => {
  it('renders the decimal string without float corruption', async () => {
    serveRide({ estimatedCost: '1200.55' })
    renderWithProviders(<RideDetail rideId={IDS.ride} />)
    expect(await screen.findByText(/1,200\.55/)).toBeVisible()
  })
})

describe('RideDetail — the matching window is explained', () => {
  /**
   * The window, not just the departure time, is what search compares against.
   * Showing it explains why a ride surfaces for a time the driver never typed.
   */
  it('shows the flexibility that widens the ride’s matching window', async () => {
    serveRide({ flexMinutes: 30 })
    renderWithProviders(<RideDetail rideId={IDS.ride} />)
    expect(await screen.findByText(/±30 min flexibility/)).toBeVisible()
  })

  it('says so when the driver set no flexibility', async () => {
    serveRide({ flexMinutes: 0 })
    renderWithProviders(<RideDetail rideId={IDS.ride} />)
    expect(await screen.findByText(/no flexibility set/i)).toBeVisible()
  })
})

describe('RideDetail — destructive actions are confirmed', () => {
  it('requires confirmation before cancelling, and warns that bookings go too', async () => {
    serveRide({ isOwner: true })
    const { user } = renderWithProviders(<RideDetail rideId={IDS.ride} />)

    await user.click(await screen.findByRole('button', { name: /cancel ride/i }))

    const dialog = await screen.findByRole('dialog')
    await waitFor(() =>
      expect(dialog).toHaveTextContent(/every confirmed booking on this ride will be cancelled/i),
    )
  })

  it('offers an optional reason, which riders are shown', async () => {
    serveRide({ isOwner: true })
    const { user } = renderWithProviders(<RideDetail rideId={IDS.ride} />)

    await user.click(await screen.findByRole('button', { name: /cancel ride/i }))
    expect(await screen.findByLabelText(/reason/i)).toBeVisible()
  })
})

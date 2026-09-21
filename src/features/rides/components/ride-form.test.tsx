import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { makeRide } from '@/mocks'
import { server } from '@/mocks/server'
import { renderWithProviders, screen, waitFor } from '@/test/render'
import { RideForm } from './ride-form'

const futureLocal = (ms: number) => {
  const d = new Date(Date.now() + ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function fillValidForm(user: ReturnType<typeof renderWithProviders>['user']) {
  const [originName, destName] = screen.getAllByLabelText(/place name/i)
  const [originLat, destLat] = screen.getAllByLabelText(/latitude/i)
  const [originLng, destLng] = screen.getAllByLabelText(/longitude/i)

  await user.type(originName!, 'Iscon Cross Road')
  await user.type(originLat!, '23.0225')
  await user.type(originLng!, '72.5714')
  await user.type(destName!, 'Vadodara Station')
  await user.type(destLat!, '22.3072')
  await user.type(destLng!, '73.1812')

  await user.type(screen.getByLabelText(/departure/i), futureLocal(3 * 60 * 60 * 1000))
  await user.clear(screen.getByLabelText(/seats/i))
  await user.type(screen.getByLabelText(/seats/i), '4')
  await user.type(screen.getByLabelText(/estimated cost/i), '1200')
}

describe('RideForm', () => {
  it('posts the flat wire shape, with money as a decimal string (§11)', async () => {
    const sent = vi.fn()
    server.use(
      http.post('*/rides', async ({ request }) => {
        sent(await request.json())
        return HttpResponse.json({ ride: makeRide({ isOwner: true }) }, { status: 201 })
      }),
    )

    const { user } = renderWithProviders(<RideForm />)
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /post ride/i }))

    await waitFor(() => expect(sent).toHaveBeenCalledTimes(1))
    const body = sent.mock.calls[0]![0] as Record<string, unknown>

    expect(body).toMatchObject({
      originLabel: 'Iscon Cross Road',
      originLat: 23.0225,
      destLabel: 'Vadodara Station',
      seatsTotal: 4,
      flexMinutes: 30,
      estimatedCost: '1200.00',
    })
    // The amount must reach the API as a string; a number means a float got in.
    expect(typeof body['estimatedCost']).toBe('string')
    expect(body['departureAt']).toMatch(/Z$/)
  })

  // spec §6 — bad input never reaches business logic.
  it('rejects a past departure in the form, without calling the API', async () => {
    const sent = vi.fn()
    server.use(
      http.post('*/rides', async () => {
        sent()
        return HttpResponse.json({ ride: makeRide() }, { status: 201 })
      }),
    )

    const { user } = renderWithProviders(<RideForm />)
    await fillValidForm(user)
    await user.clear(screen.getByLabelText(/departure/i))
    await user.type(screen.getByLabelText(/departure/i), futureLocal(-60 * 60 * 1000))
    await user.click(screen.getByRole('button', { name: /post ride/i }))

    // Scoped to the alert: the field's hint carries similar wording, and
    // matching that instead would make this test pass with validation off.
    await waitFor(() =>
      expect(
        screen.getAllByRole('alert').map((el) => el.textContent).join(' '),
      ).toMatch(/departure must be at least 15 minutes from now/i),
    )
    expect(sent).not.toHaveBeenCalled()
  })

  it('rejects a seat count of zero in the form, without calling the API', async () => {
    const sent = vi.fn()
    server.use(
      http.post('*/rides', async () => {
        sent()
        return HttpResponse.json({ ride: makeRide() }, { status: 201 })
      }),
    )

    const { user } = renderWithProviders(<RideForm />)
    await fillValidForm(user)
    await user.clear(screen.getByLabelText(/seats/i))
    await user.type(screen.getByLabelText(/seats/i), '0')
    await user.click(screen.getByRole('button', { name: /post ride/i }))

    await waitFor(() =>
      expect(
        screen.getAllByRole('alert').map((el) => el.textContent).join(' '),
      ).toMatch(/at least 1 seat/i),
    )
    expect(sent).not.toHaveBeenCalled()
  })

  /**
   * The backend validates independently and may reject what the client
   * allowed. That rejection has to land on the field, not in a generic toast.
   */
  it('maps a backend field error onto the right field', async () => {
    // The backend's real envelope: details[] with source/field/code/message.
    server.use(
      http.post('*/rides', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Request validation failed',
              details: [
                {
                  source: 'body',
                  field: 'seatsTotal',
                  code: 'too_big',
                  message: 'Your vehicle is registered for 3 seats',
                },
              ],
            },
            requestId: 'test-request-id',
          },
          { status: 400 },
        ),
      ),
    )

    const { user } = renderWithProviders(<RideForm />)
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /post ride/i }))

    expect(await screen.findByText(/registered for 3 seats/i)).toBeVisible()
  })

  it('never fires a second POST for one submit (§6.1)', async () => {
    let calls = 0
    server.use(
      http.post('*/rides', () => {
        calls += 1
        return HttpResponse.error()
      }),
    )

    const { user } = renderWithProviders(<RideForm />)
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /post ride/i }))

    await waitFor(() => expect(calls).toBe(1))
    // Give any retry a chance to appear before asserting it did not.
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(calls).toBe(1)
  })
})

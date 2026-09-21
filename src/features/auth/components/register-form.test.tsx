import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { scenarios } from '@/mocks'
import { server } from '@/mocks/server'
import { renderWithProviders, screen, waitFor } from '@/test/render'
import { RegisterForm } from './register-form'

const PASSPHRASE = 'correct horse battery staple'

async function fillForm(
  user: ReturnType<typeof renderWithProviders>['user'],
  overrides: { password?: string; confirmPassword?: string } = {},
) {
  await user.type(screen.getByLabelText(/full name/i), 'Asha Mehta')
  await user.type(screen.getByLabelText(/email/i), 'asha@example.com')
  await user.type(screen.getByLabelText(/phone/i), '+91 98111 00001')
  await user.type(screen.getByLabelText(/^password/i), overrides.password ?? PASSPHRASE)
  await user.type(screen.getByLabelText(/confirm password/i), overrides.confirmPassword ?? PASSPHRASE)
}

describe('RegisterForm', () => {
  it('never sends confirmPassword on the wire', async () => {
    const sent = vi.fn()
    server.use(
      http.post('*/api/auth/register', async ({ request }) => {
        sent(await request.json())
        return HttpResponse.json(
          { user: { id: '00000000-0000-4000-8000-000000000002', email: 'asha@example.com', fullName: 'Asha Mehta', phone: '+91 98111 00001', createdAt: new Date().toISOString() } },
          { status: 201 },
        )
      }),
    )

    const { user } = renderWithProviders(<RegisterForm />)
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(sent).toHaveBeenCalledTimes(1))
    const body = sent.mock.calls[0]![0] as Record<string, unknown>
    expect(body).toMatchObject({ fullName: 'Asha Mehta', email: 'asha@example.com' })
    expect(body).not.toHaveProperty('confirmPassword')
  })

  it('rejects a password under the API minimum without calling the API', async () => {
    const sent = vi.fn()
    server.use(http.post('*/api/auth/register', () => { sent(); return HttpResponse.json({}, { status: 201 }) }))

    const { user } = renderWithProviders(<RegisterForm />)
    await fillForm(user, { password: 'short', confirmPassword: 'short' })
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(screen.getAllByRole('alert').map((el) => el.textContent).join(' ')).toMatch(
        /at least 12 characters/i,
      ),
    )
    expect(sent).not.toHaveBeenCalled()
  })

  it('catches a mismatched confirmation on the confirm field', async () => {
    const { user } = renderWithProviders(<RegisterForm />)
    await fillForm(user, { confirmPassword: 'something else entirely' })
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(screen.getAllByRole('alert').map((el) => el.textContent).join(' ')).toMatch(
        /passwords do not match/i,
      ),
    )
  })

  it('offers a route forward when the email is already registered', async () => {
    server.use(scenarios.emailTaken())

    const { user } = renderWithProviders(<RegisterForm />)
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/already has an account/i)
    expect(screen.getByRole('link', { name: /sign in/i })).toBeVisible()
  })

  it('tells the user their phone is only shared after a confirmed booking (§9)', () => {
    renderWithProviders(<RegisterForm />)
    expect(screen.getByText(/only once a booking is confirmed/i)).toBeVisible()
  })
})

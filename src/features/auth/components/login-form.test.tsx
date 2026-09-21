import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { scenarios } from '@/mocks'
import { server } from '@/mocks/server'
import { renderWithProviders, screen, waitFor } from '@/test/render'
import { LoginForm } from './login-form'

async function signIn(user: ReturnType<typeof renderWithProviders>['user'], password = 'correct horse battery staple') {
  await user.type(screen.getByLabelText(/email/i), 'asha@example.com')
  await user.type(screen.getByLabelText(/password/i), password)
  await user.click(screen.getByRole('button', { name: /sign in/i }))
}

describe('LoginForm', () => {
  it('posts credentials to the BFF, not to the API directly', async () => {
    const sent = vi.fn()
    server.use(
      http.post('*/api/auth/login', async ({ request }) => {
        sent(new URL(request.url).pathname)
        return HttpResponse.json({ user: { id: '00000000-0000-4000-8000-000000000002', email: 'asha@example.com', fullName: 'Asha', phone: '+91 1', createdAt: new Date().toISOString() } })
      }),
    )

    const { user } = renderWithProviders(<LoginForm />)
    await signIn(user)

    await waitFor(() => expect(sent).toHaveBeenCalledWith('/api/auth/login'))
  })

  /**
   * The API returns the same message and takes the same time for a wrong
   * password and an unknown email, so login cannot be used to discover which
   * addresses have accounts. The UI must not undo that by being more specific.
   */
  it('never reveals whether the email exists', async () => {
    server.use(scenarios.invalidCredentials())

    const { user } = renderWithProviders(<LoginForm />)
    await signIn(user, 'wrong password here')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/email or password is incorrect/i)
    expect(alert).not.toHaveTextContent(/no account|not found|unknown|no such/i)
  })

  it('validates the email client-side without calling the API', async () => {
    const sent = vi.fn()
    server.use(http.post('*/api/auth/login', () => { sent(); return HttpResponse.json({}) }))

    const { user } = renderWithProviders(<LoginForm />)
    await user.type(screen.getByLabelText(/email/i), 'not-an-email')
    await user.type(screen.getByLabelText(/password/i), 'whatever')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() =>
      expect(screen.getAllByRole('alert').map((el) => el.textContent).join(' ')).toMatch(
        /valid email/i,
      ),
    )
    expect(sent).not.toHaveBeenCalled()
  })

  it('surfaces rate limiting rather than looking broken', async () => {
    server.use(scenarios.rateLimited('/api/auth/login'))

    const { user } = renderWithProviders(<LoginForm />)
    await signIn(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i)
  })

  it('does not retry a failed sign-in', async () => {
    let calls = 0
    server.use(http.post('*/api/auth/login', () => { calls += 1; return HttpResponse.error() }))

    const { user } = renderWithProviders(<LoginForm />)
    await signIn(user)

    await waitFor(() => expect(calls).toBe(1))
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(calls).toBe(1)
  })
})

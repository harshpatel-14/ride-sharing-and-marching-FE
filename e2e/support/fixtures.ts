import { test as base, expect, type Page } from '@playwright/test'

const STUB = `http://127.0.0.1:${process.env.E2E_STUB_PORT ?? 4010}`

export const ACCOUNTS = {
  driver: { email: 'asha@example.com', password: 'Password123!', name: 'Asha Mehta' },
  riderA: { email: 'bhavik@example.com', password: 'Password123!', name: 'Bhavik Patel' },
  riderB: { email: 'chirag@example.com', password: 'Password123!', name: 'Chirag Shah' },
} as const

export const RIDES = {
  /** Three seats — the ordinary booking path. */
  spacious: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  /** Exactly one seat — the race. */
  lastSeat: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  /** Already completed — the immutability lock. */
  completed: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
} as const

/** Every spec starts from the same world; the stub is one shared process. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.request.post(`${STUB}/api/v1/__test__/reset`)
    await use(page)
  },
})

export { expect }

export async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/rides\/mine/)
}

/** datetime-local wants a local wall clock, not an ISO instant. */
export function localDateTime(offsetMs: number): string {
  const d = new Date(Date.now() + offsetMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

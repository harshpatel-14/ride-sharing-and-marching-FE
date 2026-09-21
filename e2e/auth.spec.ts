import { ACCOUNTS, expect, signIn, test } from './support/fixtures'

test.describe('authentication', () => {
  test('a signed-out visitor is redirected to login and returned afterwards', async ({ page }) => {
    await page.goto('/rides/mine')

    // Redirected, with where they were going preserved.
    await expect(page).toHaveURL(/\/login\?next=%2Frides%2Fmine/)
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

    await page.getByLabel('Email').fill(ACCOUNTS.driver.email)
    await page.getByLabel('Password').fill(ACCOUNTS.driver.password)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/rides\/mine/)
  })

  /**
   * The tokens live in httpOnly cookies set by the BFF. If either becomes
   * readable from JavaScript, an XSS can take over the session — so this
   * asserts on document.cookie directly rather than trusting the config.
   */
  test('session tokens are never reachable from JavaScript', async ({ page }) => {
    await signIn(page, ACCOUNTS.driver)

    const visible = await page.evaluate(() => document.cookie)
    expect(visible).not.toContain('rs_at')
    expect(visible).not.toContain('rs_rt')

    const cookies = await page.context().cookies()
    const session = cookies.filter((c) => c.name === 'rs_at' || c.name === 'rs_rt')
    expect(session).toHaveLength(2)
    for (const cookie of session) expect(cookie.httpOnly).toBe(true)
  })

  test('a session survives a full page reload', async ({ page }) => {
    await signIn(page, ACCOUNTS.driver)
    await page.reload()
    await expect(page).toHaveURL(/\/rides\/mine/)
    await expect(page.getByRole('heading', { name: 'My rides' })).toBeVisible()
  })

  test('wrong credentials never reveal whether the email exists', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(ACCOUNTS.driver.email)
    await page.getByLabel('Password').fill('definitely the wrong one')
    await page.getByRole('button', { name: /sign in/i }).click()

    const alert = page.getByRole('alert').first()
    await expect(alert).toContainText(/email or password is incorrect/i)
    await expect(alert).not.toContainText(/no account|unknown|not found/i)
  })

  test('registering signs the user straight in', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Full name').fill('New Rider')
    await page.getByLabel('Email').fill(`new-${Date.now()}@example.com`)
    await page.getByLabel('Phone').fill('+91 98111 09999')
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery staple')
    await page.getByLabel('Confirm password').fill('correct horse battery staple')
    await page.getByRole('button', { name: /create account/i }).click()

    await expect(page).toHaveURL(/\/rides\/mine/)
  })

  test('signing out clears the session', async ({ page }) => {
    await signIn(page, ACCOUNTS.driver)
    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page).toHaveURL(/\/login/)

    await page.goto('/rides/mine')
    await expect(page).toHaveURL(/\/login/)
  })
})

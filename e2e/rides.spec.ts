import { ACCOUNTS, RIDES, expect, localDateTime, signIn, test } from './support/fixtures'

test.describe('posting and managing a ride', () => {
  test('a driver posts a ride and lands on it', async ({ page }) => {
    await signIn(page, ACCOUNTS.driver)
    await page.goto('/rides/new')

    const names = page.getByLabel(/place name|search for a place/i)
    const lats = page.getByLabel('Latitude')
    const lngs = page.getByLabel('Longitude')

    await names.nth(0).fill('Thaltej')
    await lats.nth(0).fill('23.0500')
    await lngs.nth(0).fill('72.5100')
    await names.nth(1).fill('Kankaria')
    await lats.nth(1).fill('22.9950')
    await lngs.nth(1).fill('72.6000')

    await page.getByLabel(/departure/i).fill(localDateTime(5 * 3_600_000))
    await page.getByLabel(/time flexibility/i).fill('45')
    await page.getByLabel('Seats').fill('3')
    await page.getByLabel(/estimated cost/i).fill('450')

    await page.getByRole('button', { name: /post ride/i }).click()

    await expect(page).toHaveURL(/\/rides\/[0-9a-f-]+$/)
    await expect(page.getByText('Thaltej')).toBeVisible()
    // Money formatted from the decimal string, not a float.
    await expect(page.getByText('₹450.00')).toBeVisible()
    await expect(page.getByText(/±45 min flexibility/)).toBeVisible()
  })

  // spec §6 — bad input rejected before it reaches business logic.
  test('a past departure is rejected in the form', async ({ page }) => {
    await signIn(page, ACCOUNTS.driver)
    await page.goto('/rides/new')

    const names = page.getByLabel(/place name|search for a place/i)
    await names.nth(0).fill('Thaltej')
    await page.getByLabel('Latitude').nth(0).fill('23.05')
    await page.getByLabel('Longitude').nth(0).fill('72.51')
    await names.nth(1).fill('Kankaria')
    await page.getByLabel('Latitude').nth(1).fill('22.99')
    await page.getByLabel('Longitude').nth(1).fill('72.60')
    await page.getByLabel(/departure/i).fill(localDateTime(-3_600_000))
    await page.getByLabel('Seats').fill('3')
    await page.getByLabel(/estimated cost/i).fill('450')

    await page.getByRole('button', { name: /post ride/i }).click()

    await expect(page.getByRole('alert').filter({ hasText: /at least 15 minutes from now/i })).toBeVisible()
    // Still on the form; nothing was posted.
    await expect(page).toHaveURL(/\/rides\/new/)
  })

  /**
   * spec §3.6. The lock is enforced by the API and a database trigger; what
   * this asserts is that the UI stops offering the actions at all, rather
   * than offering them and failing.
   */
  test('a completed ride renders read-only', async ({ page }) => {
    await signIn(page, ACCOUNTS.driver)
    await page.goto(`/rides/${RIDES.completed}`)

    await expect(page.getByText(/this ride is completed/i)).toBeVisible()
    await expect(page.getByText(/completed rides are locked/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /cancel ride/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /mark complete/i })).toHaveCount(0)
  })

  test('a driver completes a ride and it locks immediately', async ({ page }) => {
    await signIn(page, ACCOUNTS.driver)
    await page.goto(`/rides/${RIDES.spacious}`)

    await page.getByRole('button', { name: /mark complete/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(/locked permanently/i)
    await dialog.getByRole('button', { name: /mark complete/i }).click()

    await expect(page.getByText(/this ride is completed/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /cancel ride/i })).toHaveCount(0)
  })

  test('a rider cannot see driver controls on someone else’s ride (spec §6)', async ({ page }) => {
    await signIn(page, ACCOUNTS.riderA)
    await page.goto(`/rides/${RIDES.spacious}`)

    await expect(page.getByRole('button', { name: /book a seat/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /cancel ride/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /mark complete/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /manage bookings/i })).toHaveCount(0)
  })

  test('a non-owner reaching the manifest by URL gets not-found (spec §6)', async ({ page }) => {
    await signIn(page, ACCOUNTS.riderA)
    await page.goto(`/rides/${RIDES.spacious}/manage`)

    await expect(page.getByText(/couldn’t find that ride|could not be found/i).first()).toBeVisible()
    // And crucially, no rider contact details leaked onto the page.
    await expect(page.getByText('+91 98111')).toHaveCount(0)
  })
})

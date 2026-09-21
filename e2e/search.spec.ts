import { ACCOUNTS, expect, localDateTime, signIn, test } from './support/fixtures'

/** Fills the search form with a route that should match the seeded rides. */
async function searchPrahladToVastrapur(page: import('@playwright/test').Page, radius = '5000') {
  await page.goto('/search')

  const names = page.getByLabel(/place name|search for a place/i)
  await names.nth(0).fill('Prahlad Nagar')
  await page.getByLabel('Latitude').nth(0).fill('23.0103')
  await page.getByLabel('Longitude').nth(0).fill('72.5074')
  await names.nth(1).fill('Vastrapur')
  await page.getByLabel('Latitude').nth(1).fill('23.0364')
  await page.getByLabel('Longitude').nth(1).fill('72.5290')

  await page.getByLabel('Earliest').fill(localDateTime(60_000))
  await page.getByLabel('Latest').fill(localDateTime(12 * 3_600_000))
  await page.getByLabel(/search radius/i).fill(radius)

  await page.getByRole('button', { name: /search rides/i }).click()
}

test.describe('search and matching', () => {
  test('a matching ride is found and shows the rider’s share', async ({ page }) => {
    await signIn(page, ACCOUNTS.riderA)
    await searchPrahladToVastrapur(page)

    await expect(page.getByText(/matching ride/i)).toBeVisible()
    await expect(page.getByText('Prahlad Nagar').first()).toBeVisible()

    // estimatedShare, not estimatedCost — what this rider would actually pay.
    await expect(page.getByText('your share')).toBeVisible()
    await expect(page.getByText('₹300.00').first()).toBeVisible()
  })

  /**
   * spec §3.2 — matching is proximity of BOTH endpoints AND time overlap.
   * A tiny radius must exclude a ride whose origin is far away even though
   * the time still overlaps.
   */
  test('a ride matching only the time is not a match', async ({ page }) => {
    await signIn(page, ACCOUNTS.riderA)
    await page.goto('/search')

    const names = page.getByLabel(/place name|search for a place/i)
    // Nowhere near any seeded ride, but the same time window.
    await names.nth(0).fill('Far away')
    await page.getByLabel('Latitude').nth(0).fill('19.0760')
    await page.getByLabel('Longitude').nth(0).fill('72.8777')
    await names.nth(1).fill('Also far')
    await page.getByLabel('Latitude').nth(1).fill('18.5204')
    await page.getByLabel('Longitude').nth(1).fill('73.8567')
    await page.getByLabel('Earliest').fill(localDateTime(60_000))
    await page.getByLabel('Latest').fill(localDateTime(12 * 3_600_000))
    await page.getByRole('button', { name: /search rides/i }).click()

    await expect(page.getByText(/no rides match yet/i)).toBeVisible()
    await expect(page.getByText(/BOTH ends of your route/i)).toBeVisible()
  })

  test('a ride matching only the route is not a match', async ({ page }) => {
    await signIn(page, ACCOUNTS.riderA)
    await page.goto('/search')

    const names = page.getByLabel(/place name|search for a place/i)
    await names.nth(0).fill('Prahlad Nagar')
    await page.getByLabel('Latitude').nth(0).fill('23.0103')
    await page.getByLabel('Longitude').nth(0).fill('72.5074')
    await names.nth(1).fill('Vastrapur')
    await page.getByLabel('Latitude').nth(1).fill('23.0364')
    await page.getByLabel('Longitude').nth(1).fill('72.5290')
    // Right route, but a window well after every seeded departure.
    await page.getByLabel('Earliest').fill(localDateTime(48 * 3_600_000))
    await page.getByLabel('Latest').fill(localDateTime(60 * 3_600_000))
    await page.getByRole('button', { name: /search rides/i }).click()

    await expect(page.getByText(/no rides match yet/i)).toBeVisible()
  })

  /** A shared search link must reproduce the same screen. (§7) */
  test('a search is shareable as a URL', async ({ page }) => {
    await signIn(page, ACCOUNTS.riderA)
    await searchPrahladToVastrapur(page)
    await expect(page.getByText(/matching ride/i)).toBeVisible()

    const url = page.url()
    expect(url).toContain('originLat=')
    expect(url).toContain('departAfter=')

    await page.goto('/')
    await page.goto(url)
    await expect(page.getByText(/matching ride/i)).toBeVisible()
    await expect(page.getByText('Prahlad Nagar').first()).toBeVisible()
  })

  /** A search result is not a match, so there is nothing to reveal. (spec §3.7) */
  test('search results never show contact details', async ({ page }) => {
    await signIn(page, ACCOUNTS.riderA)
    await searchPrahladToVastrapur(page)
    await expect(page.getByText(/matching ride/i)).toBeVisible()

    await expect(page.getByText('+91 98111 00001')).toHaveCount(0)
    await expect(page.getByText('asha@example.com')).toHaveCount(0)
  })

  test('an invalid search link is explained rather than crashing', async ({ page }) => {
    await signIn(page, ACCOUNTS.riderA)
    await page.goto('/search?originLat=not-a-number&originLng=1&destLat=1&destLng=1')
    await expect(page.getByRole('alert')).toContainText(/not valid/i)
  })
})

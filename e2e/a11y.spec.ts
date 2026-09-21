import AxeBuilder from '@axe-core/playwright'
import { ACCOUNTS, RIDES, expect, signIn, test } from './support/fixtures'

/**
 * Accessibility. (§16 phase 7)
 *
 * axe catches the mechanical failures — contrast, labelling, roles. It cannot
 * tell you whether the app is usable by keyboard, so the keyboard specs below
 * walk the critical paths without a mouse.
 */
const scan = (page: import('@playwright/test').Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()

test.describe('accessibility', () => {
  test('the landing page has no detectable violations', async ({ page }) => {
    await page.goto('/')
    const results = await scan(page)
    expect(results.violations).toEqual([])
  })

  test('sign in has no detectable violations', async ({ page }) => {
    await page.goto('/login')
    const results = await scan(page)
    expect(results.violations).toEqual([])
  })

  test('register has no detectable violations', async ({ page }) => {
    await page.goto('/register')
    const results = await scan(page)
    expect(results.violations).toEqual([])
  })

  test('posting a ride has no detectable violations', async ({ page }) => {
    await signIn(page, ACCOUNTS.driver)
    await page.goto('/rides/new')
    const results = await scan(page)
    expect(results.violations).toEqual([])
  })

  test('ride detail has no detectable violations', async ({ page }) => {
    await signIn(page, ACCOUNTS.riderA)
    await page.goto(`/rides/${RIDES.spacious}`)
    await expect(page.getByRole('button', { name: /book a seat/i })).toBeVisible()
    const results = await scan(page)
    expect(results.violations).toEqual([])
  })

  test('search has no detectable violations', async ({ page }) => {
    await signIn(page, ACCOUNTS.riderA)
    await page.goto('/search')
    const results = await scan(page)
    expect(results.violations).toEqual([])
  })

  test('my bookings has no detectable violations', async ({ page }) => {
    await signIn(page, ACCOUNTS.riderA)
    await page.goto(`/rides/${RIDES.spacious}`)
    await page.getByRole('button', { name: /book a seat/i }).click()
    await page.waitForURL(/\/bookings/)
    const results = await scan(page)
    expect(results.violations).toEqual([])
  })

  /** A modal that traps focus badly is unusable, and axe cannot see it. */
  test('the cancel-ride dialog is reachable and dismissible by keyboard', async ({ page }) => {
    await signIn(page, ACCOUNTS.driver)
    await page.goto(`/rides/${RIDES.spacious}`)

    await page.getByRole('button', { name: /cancel ride/i }).focus()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    expect((await scan(page)).violations).toEqual([])

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
})

test.describe('keyboard navigation', () => {
  test('a rider can sign in without a mouse', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').focus()
    await page.keyboard.type(ACCOUNTS.riderA.email)
    await page.keyboard.press('Tab')
    await page.keyboard.type(ACCOUNTS.riderA.password)
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/rides\/mine/)
  })

  test('a rider can book a seat without a mouse', async ({ page }) => {
    await signIn(page, ACCOUNTS.riderA)
    await page.goto(`/rides/${RIDES.spacious}`)

    await page.getByRole('button', { name: /book a seat/i }).focus()
    await page.keyboard.press('Enter')

    await page.waitForURL(/\/bookings/)
    await expect(page.getByText(/confirmed/i).first()).toBeVisible()
  })

  test('focus is visible on the primary action', async ({ page }) => {
    await page.goto('/login')
    const button = page.getByRole('button', { name: /sign in/i })
    await button.focus()

    // :focus-visible must produce a real outline, not outline:none.
    const outline = await button.evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(outline).not.toBe('none')
  })
})

import { ACCOUNTS, RIDES, expect, signIn, test } from './support/fixtures'

test.describe('booking a seat', () => {
  test('a rider books a seat and then sees the driver’s contact details', async ({ page }) => {
    await signIn(page, ACCOUNTS.riderA)
    await page.goto(`/rides/${RIDES.spacious}`)

    // Before booking there is no match, so no contact details. (spec §3.7)
    await expect(page.getByText(/driver contact/i)).toHaveCount(0)
    await expect(page.getByText('+91 98111 00001')).toHaveCount(0)

    await page.getByRole('button', { name: /book a seat/i }).click()
    await page.waitForURL(/\/bookings/)

    await expect(page.getByText(/confirmed/i).first()).toBeVisible()
    await expect(page.getByText('₹300.00').first()).toBeVisible()

    // Now the booking exists, the details are released.
    await page.goto(`/rides/${RIDES.spacious}`)
    await expect(page.getByText(/driver contact/i)).toBeVisible()
    await expect(page.getByText('+91 98111 00001')).toBeVisible()
  })

  test('a driver cannot book their own ride', async ({ page }) => {
    await signIn(page, ACCOUNTS.driver)
    await page.goto(`/rides/${RIDES.spacious}`)
    await expect(page.getByRole('button', { name: /book a seat/i })).toHaveCount(0)
  })

  test('booking a completed ride is not offered (spec §3.6)', async ({ page }) => {
    await signIn(page, ACCOUNTS.riderA)
    await page.goto(`/rides/${RIDES.completed}`)
    await expect(page.getByRole('button', { name: /book a seat/i })).toHaveCount(0)
    await expect(page.getByText(/this ride is completed/i)).toBeVisible()
  })

  test('cancelling returns the seat and zeroes what is owed', async ({ page }) => {
    await signIn(page, ACCOUNTS.riderA)
    await page.goto(`/rides/${RIDES.spacious}`)
    await page.getByRole('button', { name: /book a seat/i }).click()
    await page.waitForURL(/\/bookings/)

    await page.getByRole('button', { name: /cancel booking/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(/seat becomes available again immediately/i)
    await dialog.getByRole('button', { name: /cancel booking/i }).click()

    await expect(page.getByText(/you cancelled/i)).toBeVisible()
    // seatShare is kept as the record; amountOwed drops to zero.
    await expect(page.getByText('₹0.00')).toBeVisible()
  })
})

test.describe('the last-seat race (spec §3.3)', () => {
  /**
   * THE test this product is graded on, driven through two real browsers.
   *
   * Two riders load the same one-seat ride, then click Book at the same
   * moment. Exactly one must get a confirmed booking; the other must get the
   * recovery dialog — not an error, and not a second seat.
   */
  test('two riders click Book at once and exactly one wins', async ({ browser }) => {
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await pageA.request.post(`http://127.0.0.1:${process.env.E2E_STUB_PORT ?? 4010}/api/v1/__test__/reset`)

    await signIn(pageA, ACCOUNTS.riderA)
    await signIn(pageB, ACCOUNTS.riderB)

    await pageA.goto(`/rides/${RIDES.lastSeat}`)
    await pageB.goto(`/rides/${RIDES.lastSeat}`)

    // Both see one seat, and both are warned it may vanish.
    await expect(pageA.getByText('1 of 1 seats free')).toBeVisible()
    await expect(pageB.getByText('1 of 1 seats free')).toBeVisible()
    await expect(pageA.getByText(/last seat/i)).toBeVisible()

    const buttonA = pageA.getByRole('button', { name: /book a seat/i })
    const buttonB = pageB.getByRole('button', { name: /book a seat/i })

    // Fire both without awaiting either, so the requests genuinely overlap.
    await Promise.all([buttonA.click(), buttonB.click()])

    const wonA = await pageA.waitForURL(/\/bookings/, { timeout: 8000 }).then(() => true).catch(() => false)
    const wonB = await pageB.waitForURL(/\/bookings/, { timeout: 8000 }).then(() => true).catch(() => false)

    // Exactly one winner.
    expect([wonA, wonB].filter(Boolean)).toHaveLength(1)

    const loser = wonA ? pageB : pageA
    const winner = wonA ? pageA : pageB

    // The loser gets a coherent recovery, never a generic failure.
    const dialog = loser.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(/that seat just went/i)
    await expect(dialog).toContainText(/nothing was charged/i)
    await expect(loser.getByRole('link', { name: /find a similar ride/i })).toBeVisible()
    await expect(loser.getByText(/something went wrong/i)).toHaveCount(0)

    // And the winner holds exactly one confirmed booking.
    await expect(winner.getByText(/confirmed/i).first()).toBeVisible()

    // The seat really is gone for the loser once they dismiss the dialog.
    await loser.getByRole('button', { name: /stay here/i }).click()
    await expect(loser.getByText('No seats left')).toBeVisible()

    await contextA.close()
    await contextB.close()
  })
})

test.describe('driver cancels a ride (spec §3.4)', () => {
  test('the rider sees who cancelled, why, and that nothing is owed', async ({ browser }) => {
    const riderContext = await browser.newContext()
    const driverContext = await browser.newContext()
    const riderPage = await riderContext.newPage()
    const driverPage = await driverContext.newPage()

    await riderPage.request.post(`http://127.0.0.1:${process.env.E2E_STUB_PORT ?? 4010}/api/v1/__test__/reset`)

    await signIn(riderPage, ACCOUNTS.riderA)
    await riderPage.goto(`/rides/${RIDES.spacious}`)
    await riderPage.getByRole('button', { name: /book a seat/i }).click()
    await riderPage.waitForURL(/\/bookings/)

    await signIn(driverPage, ACCOUNTS.driver)
    await driverPage.goto(`/rides/${RIDES.spacious}`)
    await driverPage.getByRole('button', { name: /cancel ride/i }).click()
    const dialog = driverPage.getByRole('dialog')
    await expect(dialog).toContainText(/every confirmed booking on this ride will be cancelled/i)
    await dialog.getByLabel(/reason/i).fill('Car trouble')
    await dialog.getByRole('button', { name: /cancel ride/i }).click()
    await expect(driverPage.getByText(/this ride was cancelled/i)).toBeVisible()

    // The rider's record survives, with the cause and the reason.
    await riderPage.reload()
    await expect(riderPage.getByText(/driver cancelled/i).first()).toBeVisible()
    await expect(riderPage.getByText(/car trouble/i)).toBeVisible()
    await expect(riderPage.getByText(/owe nothing/i)).toBeVisible()
    await expect(riderPage.getByRole('link', { name: /find another ride/i })).toBeVisible()

    // Contact details are withdrawn the moment the booking stops being confirmed.
    await riderPage.goto(`/rides/${RIDES.spacious}`)
    await expect(riderPage.getByText('+91 98111 00001')).toHaveCount(0)

    await riderContext.close()
    await driverContext.close()
  })
})

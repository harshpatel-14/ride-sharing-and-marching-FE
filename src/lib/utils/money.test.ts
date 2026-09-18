import { describe, expect, it } from 'vitest'
import { formatMoney } from './money'

describe('formatMoney (§11)', () => {
  it('renders integer minor units as currency', () => {
    expect(formatMoney(120_000)).toMatch(/1,200\.00/)
  })

  it('renders zero without falling back to an empty string', () => {
    expect(formatMoney(0)).toMatch(/0\.00/)
  })

  it('keeps two fraction digits for a value that divides unevenly', () => {
    // 100000 paise split three ways is the backend's problem; we only display.
    expect(formatMoney(33_333)).toMatch(/333\.33/)
  })
})

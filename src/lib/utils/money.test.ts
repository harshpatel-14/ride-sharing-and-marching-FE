import { describe, expect, it } from 'vitest'
import { compareAmounts, formatMoney, hasIncreased, isDecimalString, toWireAmount } from './money'

describe('formatMoney — decimal strings, never floats (§11)', () => {
  it('formats a decimal string as currency', () => {
    expect(formatMoney('320.00')).toMatch(/320\.00/)
  })

  it('groups large amounts', () => {
    expect(formatMoney('1200.00')).toMatch(/1,200\.00/)
  })

  it('renders zero rather than falling back to empty', () => {
    expect(formatMoney('0.00')).toMatch(/0\.00/)
  })

  /**
   * The whole reason money stays a string: Number("1200.55") is
   * 1200.5500000000001, and the cost split has to reconcile with an audit
   * trail to the paisa.
   */
  it('keeps a value that a float would corrupt', () => {
    expect(formatMoney('1200.55')).toMatch(/1,200\.55/)
  })

  it('preserves precision on a large amount', () => {
    expect(formatMoney('99999999.99')).toMatch(/99,999,999\.99|9,99,99,999\.99/)
  })

  it('returns the input unchanged rather than NaN when it is not an amount', () => {
    expect(formatMoney('not-money')).toBe('not-money')
  })
})

describe('toWireAmount — normalises user input to the wire form', () => {
  it.each([
    ['300', '300.00'],
    ['300.5', '300.50'],
    ['300.50', '300.50'],
    ['0', '0.00'],
    [' 300 ', '300.00'],
  ])('normalises %o to %o', (input, expected) => {
    expect(toWireAmount(input)).toBe(expected)
  })

  it.each(['', 'abc', '12.345', '-1', '1,200', '1 200'])('rejects %o', (input) => {
    expect(toWireAmount(input)).toBeNull()
  })
})

describe('compareAmounts — comparison without a float in sight', () => {
  it('orders amounts correctly', () => {
    expect(compareAmounts('100.00', '150.00')).toBeLessThan(0)
    expect(compareAmounts('150.00', '100.00')).toBeGreaterThan(0)
    expect(compareAmounts('150.00', '150.00')).toBe(0)
  })

  it('distinguishes a one-paisa difference', () => {
    expect(compareAmounts('150.00', '150.01')).toBeLessThan(0)
  })

  it('compares values that would collide after float rounding', () => {
    expect(compareAmounts('1200.55', '1200.56')).toBeLessThan(0)
  })

  /**
   * A rider's share goes UP when someone else cancels. The UI has to be able
   * to detect that — docs/FRONTEND.md is explicit that a silently increasing
   * charge is what people dispute.
   */
  it('detects an increased share after another rider cancels', () => {
    expect(hasIncreased('100.00', '150.00')).toBe(true)
    expect(hasIncreased('150.00', '100.00')).toBe(false)
    expect(hasIncreased('150.00', '150.00')).toBe(false)
  })
})

describe('isDecimalString', () => {
  it.each(['0', '0.00', '320.00', '1200.5'])('accepts %o', (v) => {
    expect(isDecimalString(v)).toBe(true)
  })
  it.each(['', '1.234', 'abc', '1,2'])('rejects %o', (v) => {
    expect(isDecimalString(v)).toBe(false)
  })
})

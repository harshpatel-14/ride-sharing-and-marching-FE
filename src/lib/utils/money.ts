/**
 * Money is integer minor units (paise) end to end — never a float. (§11)
 *
 * This module FORMATS money. It does not compute it. The cost split is
 * calculated by the backend and recorded in the audit trail; a second
 * implementation here would eventually disagree by a paisa and make that
 * trail worthless as evidence in a dispute.
 */
export function formatMoney(minorUnits: number, currency = 'INR', locale = 'en-IN'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minorUnits / 100)
}

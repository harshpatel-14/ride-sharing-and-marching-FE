import { format, formatDistanceToNowStrict, isBefore, parseISO } from 'date-fns'

/**
 * Departure times cross timezones. Everything on the wire is an ISO 8601 string
 * in UTC; formatting happens once, here, at the render edge. Never do raw Date
 * arithmetic on a departure time elsewhere. (§1)
 */

export function formatDateTime(iso: string, pattern = "d MMM yyyy, HH:mm"): string {
  return format(parseISO(iso), pattern)
}

export function formatTimeWindow(fromIso: string, toIso: string): string {
  const from = parseISO(fromIso)
  const to = parseISO(toIso)
  const sameDay = format(from, 'yyyy-MM-dd') === format(to, 'yyyy-MM-dd')
  return sameDay
    ? `${format(from, 'd MMM, HH:mm')} – ${format(to, 'HH:mm')}`
    : `${format(from, 'd MMM, HH:mm')} – ${format(to, 'd MMM, HH:mm')}`
}

export function formatRelative(iso: string): string {
  return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true })
}

export function isPast(iso: string, now: Date = new Date()): boolean {
  return isBefore(parseISO(iso), now)
}

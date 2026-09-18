/**
 * Structured logging. (§13)
 *
 * Never log a bare string — a string cannot be queried. Every entry is an
 * event name plus a context object, so `booking.conflict` can be counted.
 *
 * NEVER LOG: contact details, tokens, or precise coordinates. Coordinates are
 * personal data — a home pickup point is a home address. Redaction below is a
 * safety net, not a licence to pass them in.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'
type Context = Record<string, unknown>

const REDACTED_KEYS = new Set([
  'password', 'token', 'accessToken', 'refreshToken', 'authorization', 'cookie',
  'phone', 'email', 'contact', 'driverContact', 'riderContact', 'lat', 'lng',
])

function redact(context: Context): Context {
  const out: Context = {}
  for (const [key, value] of Object.entries(context)) {
    if (REDACTED_KEYS.has(key)) {
      out[key] = '[redacted]'
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redact(value as Context)
    } else {
      out[key] = value
    }
  }
  return out
}

function emit(level: Level, event: string, context: Context = {}) {
  const entry = {
    level,
    event,
    at: new Date().toISOString(),
    side: typeof window === 'undefined' ? 'server' : 'client',
    ...redact(context),
  }

  // Replace this sink with Sentry/OTel in phase 7. The call sites don't change.
  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else if (process.env.NODE_ENV !== 'production') console.warn(line)
}

export const logger = {
  debug: (event: string, context?: Context) => emit('debug', event, context),
  info: (event: string, context?: Context) => emit('info', event, context),
  warn: (event: string, context?: Context) => emit('warn', event, context),
  error: (event: string, context?: Context) => emit('error', event, context),
}

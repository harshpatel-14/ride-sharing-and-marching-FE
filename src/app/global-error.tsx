'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logger'

/**
 * Root error boundary. Replaces the whole document, so it ships its own <html>.
 * Wire Sentry here in phase 7 — the digest is the correlation handle. (§13)
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('app.unhandled_error', { message: error.message, digest: error.digest })
  }, [error])

  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-fg-muted">
            The error has been logged. Try again, and if it keeps happening, quote reference{' '}
            <code className="font-mono">{error.digest ?? 'n/a'}</code>.
          </p>
          <button
            onClick={reset}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}

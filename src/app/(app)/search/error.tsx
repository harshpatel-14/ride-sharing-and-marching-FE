'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui'
import { logger } from '@/lib/logger'

export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('search.render_failed', { message: error.message, digest: error.digest })
  }, [error])

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">Search couldn’t run</h1>
      <p className="text-sm text-fg-muted">
        Reference <code className="font-mono">{error.digest ?? 'n/a'}</code>.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}

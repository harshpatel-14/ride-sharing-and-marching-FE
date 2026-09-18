'use client'

import { useEffect, useState, type ReactNode } from 'react'

/**
 * Starts MSW in the browser when NEXT_PUBLIC_ENABLE_MSW=true.
 *
 * This is what makes phase 2's promise literal: the whole UI can be built and
 * demoed with the Express API switched off entirely. The handlers are the same
 * ones the test suite uses, so a mock that drifts from the contract fails a
 * test rather than quietly misleading development. (§12, §16)
 *
 * The worker bundle is dynamically imported so it never enters the production
 * build graph.
 */
export function MswProvider({ children }: { children: ReactNode }) {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_MSW === 'true'
  const [ready, setReady] = useState(!enabled)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    void (async () => {
      const { worker } = await import('./browser')
      await worker.start({ onUnhandledRequest: 'bypass' })
      if (!cancelled) setReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [enabled])

  // Holding the first paint avoids a flash of real (failing) requests before
  // the service worker is listening.
  if (!ready) return null
  return <>{children}</>
}

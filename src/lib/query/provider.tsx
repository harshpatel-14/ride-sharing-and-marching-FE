'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { getQueryClient } from './client'

export function QueryProvider({ children }: { children: ReactNode }) {
  // Not useState/useMemo — getQueryClient() already handles the server/browser
  // split, and a suspended render must not create a second client.
  const queryClient = getQueryClient()

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

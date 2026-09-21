'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { parseSearchParams, toSearchParams, type SearchQuery } from '../schemas'

/**
 * Search state lives in the URL. (§7)
 *
 * Not component state, for four reasons that are all product requirements in
 * disguise: a rider can share a search, the back button works, the RSC can
 * render results on first paint with no client JS, and a slow query at 10 000
 * open rides is reproducible by pasting a link.
 */
export function useSearchQuery() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const parsed = useMemo(
    () => parseSearchParams(Object.fromEntries(searchParams.entries())),
    [searchParams],
  )

  const submit = useCallback(
    (query: SearchQuery) => {
      // `push`, not `replace`: each distinct search should be a back-button stop.
      router.push(`${pathname}?${toSearchParams(query).toString()}`)
    },
    [pathname, router],
  )

  return {
    /** The valid query, or null when the URL carries none (or an invalid one). */
    query: parsed.success ? parsed.data : null,
    /** Present when the URL had params but they did not validate. */
    error: !parsed.success && searchParams.size > 0 ? parsed.error : null,
    hasParams: searchParams.size > 0,
    submit,
  }
}

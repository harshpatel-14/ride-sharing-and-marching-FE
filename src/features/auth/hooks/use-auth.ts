'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query'
import { isUnauthenticated, toUserMessage } from '@/lib/api'
import { logger } from '@/lib/logger'
import { authApi } from '../api/auth.api'
import type { LoginInput, RegisterInput } from '../schemas'

/** The signed-in user, or null. Never throws for "not signed in". */
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: async () => {
      try {
        return await authApi.me()
      } catch (error) {
        if (isUnauthenticated(error)) return null
        throw error
      }
    },
    staleTime: 60_000,
  })
}

/** `next` is the path to return to after signing in, from ?next= on /login. */
export function useLogin(next?: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    retry: false,
    onSuccess: (user) => {
      logger.info('auth.login_succeeded', { userId: user.id })
      queryClient.setQueryData(queryKeys.session, user)
      // The session lives in httpOnly cookies that Server Components read, so
      // the server tree must re-render before the redirect lands.
      router.refresh()
      router.replace(safeNext(next) ?? '/rides/mine')
    },
    onError: (error) => toast.error(toUserMessage(error)),
  })
}

/**
 * Only same-origin relative paths are honoured. `?next=https://evil.example`
 * would otherwise turn our own login form into an open redirect.
 */
function safeNext(next: string | undefined): string | null {
  if (!next) return null
  if (!next.startsWith('/') || next.startsWith('//')) return null
  return next
}

export function useRegister() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    retry: false,
    onSuccess: (user) => {
      logger.info('auth.register_succeeded', { userId: user.id })
      queryClient.setQueryData(queryKeys.session, user)
      router.refresh()
      router.replace('/rides/mine')
    },
    onError: (error) => toast.error(toUserMessage(error)),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: () => authApi.logout(),
    retry: false,
    // Clearing the cache runs on settle, not success: if the API call failed
    // the cookies were cleared anyway, and leaving a stale user on screen
    // after "log out" is worse than a redundant redirect.
    onSettled: () => {
      queryClient.clear()
      router.refresh()
      router.replace('/login')
    },
  })
}

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/features/auth'
import { getCurrentUser } from '@/features/auth/server'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  // Already signed in? Don't show a login form — go where they were heading.
  if (await getCurrentUser()) redirect('/rides/mine')

  const { next } = await searchParams

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-fg-muted">Every ride and booking is tied to a real account.</p>
      </div>
      <LoginForm next={next} />
    </div>
  )
}

import type { ReactNode } from 'react'
import { AppHeader } from '@/components/layout'
import { UserMenu } from '@/features/auth'
import { requireUser } from '@/features/auth/server'

/**
 * Authenticated shell. (§4)
 *
 * Three enforcement points, none sufficient alone:
 *   middleware  — cheap cookie-presence redirect, no validation
 *   this layout — `requireUser()` makes a real /me call and redirects on failure
 *   Express     — owns ownership; reaching someone else's record by id is 404
 *
 * This is authentication only. Whether a ride is yours to cancel is decided by
 * the API and enforced in the database.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()

  return (
    <div className="min-h-dvh">
      <AppHeader actions={<UserMenu fullName={user.fullName} />} />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}

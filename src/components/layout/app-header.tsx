import Link from 'next/link'
import type { ReactNode } from 'react'
import { site } from '@/config/site'

/**
 * App chrome. Takes a display name and a slot, not a User.
 *
 * A "shared" component that imports a feature's types is not shared — it is
 * that feature's component in the wrong folder (§3). The sign-out control is
 * passed in as `actions` so the auth feature owns its own behaviour.
 */
export function AppHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          {site.name}
        </Link>

        <nav aria-label="Main" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {site.nav.map((item) => (
            <Link key={item.href} href={item.href} className="text-fg-muted hover:text-fg">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto">{actions}</div>
      </div>
    </header>
  )
}

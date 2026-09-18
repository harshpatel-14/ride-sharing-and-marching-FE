import Link from 'next/link'
import { buttonVariants } from '@/components/ui'
import { site } from '@/config/site'
import { cn } from '@/lib/utils'

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 px-4 py-16">
      <div className="space-y-3">
        <p className="text-sm font-medium text-brand">{site.name}</p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          A seat that is actually yours.
        </h1>
        <p className="max-w-xl text-fg-muted text-pretty">{site.description}</p>
      </div>

      <nav className="flex flex-wrap gap-3">
        <Link href="/search" className={cn(buttonVariants({ variant: 'primary' }))}>
          Find a ride
        </Link>
        <Link href="/rides/new" className={cn(buttonVariants({ variant: 'outline' }))}>
          Offer a ride
        </Link>
      </nav>

      <p className="rounded-card border border-border bg-surface-muted p-4 text-sm text-fg-muted">
        Foundation and contract layers are in place. Routes land in phases 3–6 — see{' '}
        <code className="font-mono text-xs">FRONTEND-ARCHITECTURE.md §16</code>.
      </p>
    </main>
  )
}

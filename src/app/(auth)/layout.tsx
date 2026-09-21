import Link from 'next/link'
import type { ReactNode } from 'react'
import { site } from '@/config/site'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-6 text-lg font-semibold tracking-tight">
        {site.name}
      </Link>
      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-6">
        {children}
      </div>
    </div>
  )
}

'use client'

import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui'
import { useLogout } from '../hooks/use-auth'

export function UserMenu({ fullName }: { fullName: string }) {
  const logout = useLogout()

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-fg-muted">{fullName}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        aria-label="Sign out"
      >
        <LogOut className="size-4" aria-hidden />
        Sign out
      </Button>
    </div>
  )
}

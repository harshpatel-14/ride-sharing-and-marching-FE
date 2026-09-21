import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { RegisterForm } from '@/features/auth'
import { getCurrentUser } from '@/features/auth/server'

export const metadata: Metadata = { title: 'Create an account' }

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect('/rides/mine')

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Create an account</h1>
        <p className="text-sm text-fg-muted">Takes a moment — you’ll be signed in straight away.</p>
      </div>
      <RegisterForm />
    </div>
  )
}

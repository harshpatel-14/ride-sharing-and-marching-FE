import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/features/auth/server'

/** Who am I? Used by the client-side session query. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Not signed in' }, requestId: null },
      { status: 401 },
    )
  }
  return NextResponse.json({ user })
}

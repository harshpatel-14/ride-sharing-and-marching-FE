import { NextResponse } from 'next/server'
import { clearTokens, logout, readTokens } from '@/features/auth/server'

/**
 * Ends the session. Always clears local cookies, even if the API call fails —
 * a user who clicked "log out" must end up logged out on this device
 * regardless of what the network did.
 */
export async function POST() {
  const { refreshToken } = await readTokens()
  if (refreshToken) await logout(refreshToken)

  const response = NextResponse.json({ ok: true })
  clearTokens(response.cookies)
  return response
}

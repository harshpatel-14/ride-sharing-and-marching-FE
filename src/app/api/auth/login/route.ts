import { NextResponse, type NextRequest } from 'next/server'
import { login } from '@/features/auth/server'
import { writeTokens } from '@/features/auth/server'
import { errorResponse } from '@/lib/api/bff'
import { logger } from '@/lib/logger'

/**
 * Exchanges credentials for a session. (§4)
 *
 * The tokens are written to httpOnly cookies here and the response body
 * carries only the user — so the browser learns who is signed in, but never
 * holds anything an XSS could steal.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email: string; password: string }
    const { user, tokens } = await login(body)

    const response = NextResponse.json({ user })
    writeTokens(response.cookies, tokens)
    logger.info('auth.login', { userId: user.id })
    return response
  } catch (error) {
    return errorResponse(error)
  }
}

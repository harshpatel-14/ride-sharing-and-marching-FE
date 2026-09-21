import { NextResponse, type NextRequest } from 'next/server'
import { register, writeTokens } from '@/features/auth/server'
import { errorResponse } from '@/lib/api/bff'
import { logger } from '@/lib/logger'

/** Registration returns a usable session — no separate login call needed. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email: string
      password: string
      fullName: string
      phone: string
    }
    const { user, tokens } = await register(body)

    const response = NextResponse.json({ user }, { status: 201 })
    writeTokens(response.cookies, tokens)
    logger.info('auth.registered', { userId: user.id })
    return response
  } catch (error) {
    return errorResponse(error)
  }
}

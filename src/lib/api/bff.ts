import { NextResponse } from 'next/server'
import { ApiError, isApiError } from './errors'

/** Re-shapes any thrown error into the backend's own envelope, so the client
 *  parses one format no matter which side produced the failure. */
export function errorResponse(error: unknown): NextResponse {
  const apiError: ApiError = isApiError(error)
    ? error
    : new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: 'Unexpected error' })

  return NextResponse.json(
    {
      error: { code: apiError.code, message: apiError.message, details: apiError.details },
      requestId: apiError.requestId ?? null,
    },
    // status 0 means the transport itself failed; report it as a gateway error.
    { status: apiError.status === 0 ? 502 : apiError.status },
  )
}

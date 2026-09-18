import { NextResponse } from 'next/server'

/** Liveness probe for the Docker healthcheck and compose `depends_on`. */
export function GET() {
  return NextResponse.json({ status: 'ok', at: new Date().toISOString() })
}

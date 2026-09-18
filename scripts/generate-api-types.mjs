#!/usr/bin/env node
/**
 * Generates src/types/api.d.ts from the backend's OpenAPI spec. (§5.1)
 *
 * Until Express emits that spec, the Zod schemas in src/features/ * /schemas are
 * the contract source of truth. Once it does, this script runs in CI and a
 * backend rename breaks the frontend build instead of silently rendering
 * `undefined` seats.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const SPEC = process.env.OPENAPI_SPEC ?? resolve(process.cwd(), '../backend/openapi.json')
const OUT = resolve(process.cwd(), 'src/types/api.d.ts')

if (!existsSync(SPEC)) {
  console.error(
    `\n  No OpenAPI spec at: ${SPEC}\n\n` +
      `  The backend must emit one (zod-to-openapi over the validators it already\n` +
      `  needs for spec §6) before this script can run. Until then the Zod schemas\n` +
      `  under src/features/*/schemas are the contract.\n\n` +
      `  Override the path with OPENAPI_SPEC=/path/to/openapi.json\n`,
  )
  process.exit(1)
}

execFileSync('pnpm', ['exec', 'openapi-typescript', SPEC, '-o', OUT], { stdio: 'inherit' })
console.log(`\n  Wrote ${OUT}\n  Do not hand-edit it — re-run this script instead.\n`)

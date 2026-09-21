import { z } from 'zod'

/**
 * Validated environment. Fails at boot with a readable message, not at 2am
 * with `undefined is not a valid URL` three layers into a fetch. (§15)
 */

const clientSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_MAP_STYLE_URL: z.url().optional(),
  /** Optional Nominatim-compatible geocoder. Unset falls back to manual entry. */
  NEXT_PUBLIC_GEOCODER_URL: z.url().optional(),
  NEXT_PUBLIC_ENABLE_MSW: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
})

const serverSchema = z.object({
  /** Internal address of the Express API, e.g. http://api:4000 inside Docker. */
  API_URL: z.url(),
  /** Used to sign the session cookie in phase 3. */
  SESSION_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

/**
 * Each NEXT_PUBLIC_* var must be referenced as a literal property access.
 * Next inlines these at BUILD time by textual substitution — a computed lookup
 * like `process.env[key]` is never replaced and is `undefined` in the browser.
 * This is the single most common way a Next env setup silently breaks.
 */
const rawClientEnv = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  NEXT_PUBLIC_GEOCODER_URL: process.env.NEXT_PUBLIC_GEOCODER_URL,
  NEXT_PUBLIC_ENABLE_MSW: process.env.NEXT_PUBLIC_ENABLE_MSW,
}

function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown, scope: string): z.infer<T> {
  const result = schema.safeParse(input)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid ${scope} environment:\n${issues}\n\nSee .env.example.`)
  }
  return result.data
}

const clientEnv = parseOrThrow(clientSchema, rawClientEnv, 'client')

/**
 * Server vars are parsed lazily and only on the server. Touching `env.API_URL`
 * from a Client Component is a type error, and would be a runtime error too.
 */
const serverEnv =
  typeof window === 'undefined'
    ? parseOrThrow(serverSchema, process.env, 'server')
    : (null as unknown as z.infer<typeof serverSchema>)

export const env = {
  ...clientEnv,
  get API_URL() {
    if (typeof window !== 'undefined') {
      throw new Error('env.API_URL is server-only. Use NEXT_PUBLIC_API_URL in the browser.')
    }
    return serverEnv.API_URL
  },
  get SESSION_SECRET() {
    if (typeof window !== 'undefined') {
      throw new Error('env.SESSION_SECRET is server-only and must never reach the browser.')
    }
    return serverEnv.SESSION_SECRET
  },
  get NODE_ENV() {
    return (process.env.NODE_ENV ?? 'development') as 'development' | 'test' | 'production'
  },
} as const

export const isProduction = () => env.NODE_ENV === 'production'
export const isTest = () => env.NODE_ENV === 'test'

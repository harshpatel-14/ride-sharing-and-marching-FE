import { z } from 'zod'

/**
 * Auth contract, mirroring docs/API.md.
 *
 * Note there are no roles or capabilities: driver and rider are things a user
 * *does*, not what they are. The same person posts a ride on Monday and books
 * one on Tuesday, and the backend reflects that by putting `isOwner` on each
 * ride rather than a role on the user.
 */

export const userSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  fullName: z.string().min(1),
  phone: z.string().min(1),
  createdAt: z.iso.datetime(),
})
export type User = z.infer<typeof userSchema>

export const tokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  /** Access-token lifetime in seconds — 900 (15 minutes) at the time of writing. */
  expiresIn: z.number().int().positive(),
})
export type Tokens = z.infer<typeof tokensSchema>

/** Both /auth/register and /auth/login return this. */
export const authResultSchema = z.object({ user: userSchema, tokens: tokensSchema })
export type AuthResult = z.infer<typeof authResultSchema>

export const meResponseSchema = z.object({ user: userSchema })

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})
export type LoginInput = z.infer<typeof loginSchema>

/**
 * Password is length-only, minimum 12 — matching the backend exactly.
 *
 * No character-class rules on purpose: they push people towards `Passw0rd!`
 * and away from the long passphrases that are actually strong. Mirroring the
 * rule here rather than inventing a stricter one keeps the form from rejecting
 * something the API would have accepted.
 */
export const PASSWORD_MIN_LENGTH = 12

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your name'),
    email: z.email('Enter a valid email address'),
    /** Visible to a counterparty only once a booking is confirmed. (§9) */
    phone: z
      .string()
      .trim()
      .min(6, 'Enter a valid phone number')
      .regex(/^[+]?[\d\s()-]+$/, 'Use digits, spaces, brackets, hyphens or a leading +'),
    password: z.string().min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type RegisterFormValues = z.infer<typeof registerSchema>

/** What actually goes on the wire — `confirmPassword` is a form concern only. */
export type RegisterInput = Omit<RegisterFormValues, 'confirmPassword'>

export const logoutResultSchema = z.object({ sessionsEnded: z.number().int().min(0) })

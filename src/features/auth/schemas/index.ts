import { z } from 'zod'

/**
 * Driver and rider are CAPABILITIES of one user, not separate account types.
 * The same person posts a ride on Monday and books one on Tuesday. Modelling
 * this as `role: 'driver' | 'rider'` costs a migration and a week of
 * conditional rewrites the moment someone does both. (§4)
 */
export const capabilitySchema = z.enum(['drive', 'ride'])
export type Capability = z.infer<typeof capabilitySchema>

export const sessionSchema = z.object({
  userId: z.uuid(),
  name: z.string().min(1),
  email: z.email(),
  capabilities: z.array(capabilitySchema),
})
export type Session = z.infer<typeof sessionSchema>

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.email('Enter a valid email address'),
    /** Contact number. Never rendered to another user until a booking is confirmed. (§9) */
    phone: z.string().min(8, 'Enter a valid phone number'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type RegisterInput = z.infer<typeof registerSchema>

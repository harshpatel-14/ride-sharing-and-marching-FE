import { describe, expect, it } from 'vitest'
import { PASSWORD_MIN_LENGTH, loginSchema, registerSchema, userSchema } from './index'

const validRegister = {
  fullName: 'Asha Mehta',
  email: 'asha@example.com',
  phone: '+91 98111 00001',
  password: 'correct horse battery staple',
  confirmPassword: 'correct horse battery staple',
}

describe('registerSchema — mirrors the API rules exactly', () => {
  it('accepts a well-formed registration', () => {
    expect(registerSchema.safeParse(validRegister).success).toBe(true)
  })

  /**
   * The API requires 12+ characters, length only. Mirroring it exactly matters
   * in both directions: a stricter client rule rejects passwords the API would
   * accept, and a looser one sends a doomed request.
   */
  it(`requires at least ${PASSWORD_MIN_LENGTH} characters`, () => {
    const short = 'a'.repeat(PASSWORD_MIN_LENGTH - 1)
    const result = registerSchema.safeParse({ ...validRegister, password: short, confirmPassword: short })
    expect(result.success).toBe(false)
  })

  it('accepts exactly the minimum length', () => {
    const exact = 'a'.repeat(PASSWORD_MIN_LENGTH)
    expect(
      registerSchema.safeParse({ ...validRegister, password: exact, confirmPassword: exact }).success,
    ).toBe(true)
  })

  /** No character-class rules — they push people off long passphrases. */
  it('accepts a long all-lowercase passphrase', () => {
    const phrase = 'correct horse battery staple'
    expect(
      registerSchema.safeParse({ ...validRegister, password: phrase, confirmPassword: phrase }).success,
    ).toBe(true)
  })

  it('rejects mismatched confirmation against the confirm field', () => {
    const result = registerSchema.safeParse({ ...validRegister, confirmPassword: 'something else' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['confirmPassword'])
  })

  it.each(['+91 98111 00001', '(079) 2630-1234', '9811100001'])('accepts the phone %o', (phone) => {
    expect(registerSchema.safeParse({ ...validRegister, phone }).success).toBe(true)
  })

  it.each(['abc', 'phone!'])('rejects the phone %o', (phone) => {
    expect(registerSchema.safeParse({ ...validRegister, phone }).success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('accepts any non-empty password — length rules belong to registration', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true)
  })

  it('rejects a malformed email', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false)
  })
})

describe('userSchema', () => {
  it('has no role or capability field — driver/rider is what you do, not what you are', () => {
    const user = userSchema.parse({
      id: '00000000-0000-4000-8000-000000000002',
      email: 'asha@example.com',
      fullName: 'Asha M. Mehta',
      phone: '+91 98111 00001',
      createdAt: new Date().toISOString(),
    })
    expect(user).not.toHaveProperty('role')
    expect(user).not.toHaveProperty('capabilities')
  })
})

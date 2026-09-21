import { request } from '@/lib/api'
import { meResponseSchema, userSchema, type LoginInput, type RegisterInput, type User } from '../schemas'

/**
 * Client-side auth calls.
 *
 * These target Next's own BFF routes (`/api/auth/*`), not Express. The BFF is
 * what sets the httpOnly cookies, so no token ever reaches this code — the
 * responses carry only the user. (§4)
 */
const bff = <T>(method: 'GET' | 'POST', path: string, body?: unknown) =>
  request<T>(method, path, { ...(body !== undefined ? { body } : {}), options: { baseUrl: '/api/auth' } })

export const authApi = {
  login: async (input: LoginInput): Promise<User> =>
    userSchema.parse(((await bff<{ user: unknown }>('POST', '/login', input)).user)),

  register: async (input: RegisterInput): Promise<User> =>
    userSchema.parse(((await bff<{ user: unknown }>('POST', '/register', input)).user)),

  me: async (): Promise<User> => meResponseSchema.parse(await bff('GET', '/me')).user,

  logout: async (): Promise<void> => {
    await bff('POST', '/logout')
  },
}

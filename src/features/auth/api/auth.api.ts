import { api, endpoints } from '@/lib/api'
import { sessionSchema, type LoginInput, type RegisterInput, type Session } from '../schemas'

/**
 * Auth calls go through Next's BFF route handlers, not straight to Express —
 * the route handler is what sets the httpOnly cookie the browser can't read. (§4)
 */
const BFF = '/api/auth'

export const authApi = {
  login: async (input: LoginInput): Promise<Session> =>
    sessionSchema.parse(await api.post(`${BFF}/login`, input, { baseUrl: '/' })),

  register: async (input: RegisterInput): Promise<Session> =>
    sessionSchema.parse(await api.post(`${BFF}/register`, input, { baseUrl: '/' })),

  logout: async (): Promise<void> => {
    await api.post(`${BFF}/logout`, undefined, { baseUrl: '/' })
  },

  /** Reads the session via the BFF so the browser never handles a token. */
  me: async (): Promise<Session> =>
    sessionSchema.parse(await api.get(`${BFF}/me`, { baseUrl: '/' })),
}

export { endpoints as authEndpoints }

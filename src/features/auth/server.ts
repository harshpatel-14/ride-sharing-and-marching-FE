/**
 * Server-only entry point for the auth feature.
 * Importing this from a Client Component is a build error by design.
 */
export {
  getCurrentUser,
  requireUser,
  login,
  register,
  logout,
  refreshTokens,
  ensureAccessToken,
  shouldRefresh,
  callApi,
  __resetRefreshState,
} from './api/auth.server'

export {
  readTokens,
  writeTokens,
  clearTokens,
  secondsUntilExpiry,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
} from './api/token-cookies.server'

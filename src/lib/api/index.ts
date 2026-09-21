export { api, request, type RequestOptions } from './client'
export { endpoints, BFF_PROXY_BASE, API_VERSION_PREFIX } from './endpoints'
export {
  ApiError,
  isApiError,
  isTokenExpired,
  isUnauthenticated,
  isNotFound,
  isValidation,
  isSeatUnavailable,
  isAlreadyBooked,
  isRideImmutable,
  isRideNotOpen,
  isRideTerminalError,
  isRateLimited,
  toUserMessage,
  toFieldMessages,
  codeForStatus,
  type ApiErrorCode,
  type FieldError,
} from './errors'

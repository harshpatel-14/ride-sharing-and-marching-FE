export { api, request, type RequestOptions } from './client'
export { endpoints } from './endpoints'
export {
  ApiError,
  isApiError,
  isUnauthenticated,
  isForbidden,
  isNotFound,
  isValidation,
  isConflict,
  isSeatConflict,
  isGone,
  toUserMessage,
  codeForStatus,
  type ApiErrorCode,
  type FieldError,
} from './errors'

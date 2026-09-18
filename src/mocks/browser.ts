import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

/**
 * Browser MSW, enabled with NEXT_PUBLIC_ENABLE_MSW=true. This is what lets the
 * whole UI be built while the Express API is still being written. (§16, phase 2)
 */
export const worker = setupWorker(...handlers)

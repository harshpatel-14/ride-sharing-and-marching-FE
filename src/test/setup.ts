import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import './mocks-next'
import { resetFactories } from '@/mocks/factories'
import { server } from '@/mocks/server'

beforeAll(() => {
  // A request with no handler is a test bug, not a pass. Fail loudly.
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  vi.clearAllMocks()
  server.resetHandlers()
  cleanup()
  resetFactories()
})

afterAll(() => {
  server.close()
})

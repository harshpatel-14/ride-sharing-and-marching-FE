import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetFactories } from '@/mocks/factories'
import { server } from '@/mocks/server'

beforeAll(() => {
  // A request with no handler is a test bug, not a pass. Fail loudly.
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  cleanup()
  resetFactories()
})

afterAll(() => {
  server.close()
})

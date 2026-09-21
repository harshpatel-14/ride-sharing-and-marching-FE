import { vi } from 'vitest'

export const routerPush = vi.fn()
export const routerRefresh = vi.fn()
export const toastSuccess = vi.fn()
export const toastError = vi.fn()

/**
 * Stubs for modules that assume a Next runtime or a real DOM toaster.
 * Imported by src/test/setup.ts so every test file gets them.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, refresh: routerRefresh, replace: vi.fn(), back: vi.fn() }),
  redirect: vi.fn(),
  notFound: vi.fn(),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError, info: vi.fn(), warning: vi.fn() },
  Toaster: () => null,
}))

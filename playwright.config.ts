import { defineConfig, devices } from '@playwright/test'

const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3210)
const STUB_PORT = Number(process.env.E2E_STUB_PORT ?? 4010)
const baseURL = `http://127.0.0.1:${WEB_PORT}`

/**
 * E2E against a real browser, the real frontend and a stub API (e2e/stub-api).
 *
 * `channel` is configurable because Playwright's bundled Chromium cannot be
 * downloaded in every environment. CI uses the bundled build; set
 * PLAYWRIGHT_CHANNEL=chrome to drive a locally installed Chrome instead.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false, // the stub API is one shared world; specs reset it
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
      },
    },
  ],

  webServer: [
    {
      command: 'node e2e/stub-api/server.mjs',
      env: { STUB_API_PORT: String(STUB_PORT) },
      url: `http://127.0.0.1:${STUB_PORT}/api/v1/me`,
      ignoreHTTPSErrors: true,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      // Production build on purpose: middleware, RSC and the BFF behave
      // differently in dev, and those are exactly what these specs exercise.
      command: 'pnpm start',
      env: {
        PORT: String(WEB_PORT),
        API_URL: `http://127.0.0.1:${STUB_PORT}`,
        NEXT_PUBLIC_API_URL: baseURL,
        SESSION_SECRET: 'e2e-session-secret-at-least-32-characters',
        NODE_ENV: 'production',
      },
      url: `${baseURL}/api/health`,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      stderr: 'pipe',
      timeout: 120_000,
    },
  ],
})

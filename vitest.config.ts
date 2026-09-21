import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Vite resolves the `@/*` paths from tsconfig.json natively.
    tsconfigPaths: true,
    alias: {
      // `server-only` throws on import by design; stub it so server modules
      // remain unit-testable. The Next build still enforces the real boundary.
      'server-only': new URL('./src/test/stubs/server-only.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    env: {
      API_URL: 'http://localhost:4000',
      SESSION_SECRET: 'test-session-secret-at-least-32-chars-long',
      NEXT_PUBLIC_API_URL: 'http://localhost:4000',
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/features/**', 'src/lib/**'],
      exclude: ['src/**/index.ts', 'src/test/**', 'src/types/**'],
    },
  },
  define: {
    'process.env.NEXT_PUBLIC_API_URL': JSON.stringify('http://localhost:4000'),
  },
  // Satisfies the Zod-validated env in server-environment tests.
  envPrefix: ['NEXT_PUBLIC_'],
})

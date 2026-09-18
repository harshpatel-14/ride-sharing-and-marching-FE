import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Cuts the Docker image from ~1.2GB to ~150MB (architecture §15).
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,

  // Fail the build on type errors. A green build that ships broken types is
  // worse than no build at all. (Next 16 removed the `eslint` build key —
  // linting runs as its own CI step, see `pnpm verify`.)
  typescript: { ignoreBuildErrors: false },

  experimental: {
    // Server Actions are not used for API calls (Express owns business logic,
    // architecture §0.2) but Next requires the body limit to be explicit.
    serverActions: { bodySizeLimit: '1mb' },
  },
}

export default nextConfig

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import boundaries from 'eslint-plugin-boundaries'
import tseslint from 'typescript-eslint'

const LAYERS = ['app', 'feature', 'shared-ui', 'lib', 'config', 'types']

export default tseslint.config(
  {
    ignores: [
      '.next/**', 'node_modules/**', 'out/**', 'coverage/**',
      'src/types/api.d.ts', 'next-env.d.ts', 'public/**',
    ],
  },

  ...nextCoreWebVitals,
  ...nextTypescript,

  /* ────────────────────────────────────────────────────────────────────────
   * Architecture §3 — layering, mechanically enforced.
   *
   * These rules are the reason the codebase stays navigable at 200 files.
   * A violation is a build failure, not a code-review comment.
   * ──────────────────────────────────────────────────────────────────────── */
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        // Routing only. Depends on everything, is depended on by nothing.
        { type: 'app', pattern: 'src/app' },

        // Vertical slices — one element per feature directory.
        { type: 'feature', pattern: 'src/features/*', capture: ['name'] },

        { type: 'shared-ui', pattern: 'src/components' },
        { type: 'lib', pattern: 'src/lib' },
        { type: 'config', pattern: 'src/config' },
        { type: 'types', pattern: 'src/types' },
        { type: 'test', pattern: 'src/test' },
        // Fixtures + MSW handlers. Consumed by BOTH the test suite and the
        // dev runtime, so it is a peer of the layer stack, not part of it.
        { type: 'mocks', pattern: 'src/mocks' },
      ],
      // Lets a colocated *.test.ts reach the test helpers without opening that
      // door for production code.
      'boundaries/files': [
        { category: 'test', pattern: 'src/**/*.{test,spec}.{ts,tsx}' },
      ],
    },
    rules: {
      'boundaries/dependencies': ['error', {
        default: 'disallow',
        message: '{{from.type}} may not import {{to.type}} — see FRONTEND-ARCHITECTURE.md §3',
        policies: [
          { from: { element: { type: 'app' } },
            allow: { to: { element: { types: { anyOf: ['feature', 'shared-ui', 'lib', 'config', 'types'] } } } } },

          { from: { element: { type: 'feature' } },
            allow: { to: { element: { types: { anyOf: ['feature', 'shared-ui', 'lib', 'config', 'types'] } } } } },

          { from: { element: { type: 'shared-ui' } },
            allow: { to: { element: { types: { anyOf: ['lib', 'config', 'types'] } } } } },

          { from: { element: { type: 'lib' } },
            allow: { to: { element: { types: { anyOf: ['config', 'types'] } } } } },

          { from: { element: { type: 'config' } },
            allow: { to: { element: { type: 'types' } } } },

          // Tests and mocks sit outside the hierarchy on purpose — they must
          // see every layer in order to mirror the contract faithfully.
          { from: { element: { types: { anyOf: ['test', 'mocks'] } } },
            allow: { to: { element: { types: { anyOf: [...LAYERS, 'test', 'mocks'] } } } } },

          // The app may start MSW in the browser (dev-only, dynamically imported).
          { from: { element: { type: 'app' } },
            allow: { to: { element: { type: 'mocks' } } } },

          // A colocated test file may reach the shared fixtures and helpers.
          { from: { file: { categories: 'test' } },
            allow: { to: { element: { types: { anyOf: ['test', 'mocks'] } } } } },

          // A feature's internals are private: cross-feature imports go through
          // index.ts. Same-feature relative imports are unaffected (the plugin
          // does not check dependencies within one element). This is what lets
          // you restructure a feature freely, forever. (§2)
          { disallow: { to: { element: { type: 'feature', internalPath: '!index.ts' } } },
            message: "Import a feature from its root barrel (@/features/<name>), never its internals — see FRONTEND-ARCHITECTURE.md §2" },
        ],
      }],
    },
  },

  /* Project-wide TypeScript hygiene. */
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // §13 — a bare string cannot be queried. Use lib/logger.
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // §0.1, §11 — money and seat counts are server-owned integers.
      'no-restricted-syntax': ['error', {
        selector: "MemberExpression[object.name='Math'][property.name='round']",
        message: 'Money and seat counts are integers owned by the server (§0.1, §11). If you are rounding currency on the client, stop.',
      }],
    },
  },

  /* Tests get to be loose. */
  {
    files: ['src/test/**/*', 'src/**/*.{test,spec}.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)

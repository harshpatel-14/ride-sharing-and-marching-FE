/**
 * No-op stub for the `server-only` package.
 *
 * That package throws on import to keep server modules out of client bundles.
 * Vitest is neither a client nor a server bundle, so the guard has nothing
 * useful to say here — but it still throws, which would make server modules
 * untestable. The real protection is the Next build, which is unaffected.
 */
export {}

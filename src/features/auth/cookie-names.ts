/**
 * Cookie names, in their own module with no `server-only` import.
 *
 * Middleware runs on the Edge runtime and cannot import the Node-only token
 * helpers, but it still needs to know which cookies to look for. Keeping the
 * names here avoids duplicating string literals across two runtimes.
 */
export const ACCESS_COOKIE = 'rs_at'
export const REFRESH_COOKIE = 'rs_rt'

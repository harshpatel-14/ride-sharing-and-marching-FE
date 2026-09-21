/**
 * Server-only entry point for the rides feature.
 *
 * Importing this from a Client Component is a build error by design — that is
 * the whole reason it is separate from index.ts.
 */
export { serverRidesApi } from './api/rides.server'

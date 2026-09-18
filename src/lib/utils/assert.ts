/**
 * Exhaustiveness guard. Put this in the `default` of a switch over a union and
 * the compiler will tell you the day someone adds a new ride status.
 */
export function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unexpected value: ${JSON.stringify(value)}`)
}

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invariant violation: ${message}`)
}

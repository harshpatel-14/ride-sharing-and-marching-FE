# Ride Sharing & Matching — Frontend

React 19 · Next.js 16 (App Router) · TypeScript (strict) · TanStack Query · Zod · Tailwind 4

The architecture this implements is in [FRONTEND-ARCHITECTURE.md](./FRONTEND-ARCHITECTURE.md).
Section references below (§) point there. The product spec is
[21-ride-sharing-and-matching.md](./21-ride-sharing-and-matching.md).

**Status: phases 1 (Foundation) and 2 (Contract) complete.** Routes land in phases 3–6 (§16).

---

## Quick start

```bash
pnpm install
cp .env.example .env.local     # SESSION_SECRET must be ≥32 chars
pnpm dev                       # http://localhost:3000
```

No backend yet? Run the whole UI against the mock API:

```bash
NEXT_PUBLIC_ENABLE_MSW=true pnpm dev
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build (standalone output) and serve |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint, including the architectural boundary rules |
| `pnpm test` | Vitest + MSW |
| `pnpm verify` | typecheck → lint → test. Run this before pushing. |
| `pnpm api:types` | Regenerate `src/types/api.d.ts` from the backend's OpenAPI spec |

---

## What phase 1 delivered

- **Next 16 App Router** scaffold, `output: 'standalone'`, React 19.
- **TypeScript strict+**: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, `noUnusedLocals`. These are on from commit one because
  retrofitting them across 200 files is a week nobody schedules.
- **Enforced boundaries** (§3) via `eslint-plugin-boundaries`. Verified to fire:
  `lib` importing a feature, `components` importing a feature, and any import that
  reaches past a feature's `index.ts` are all build failures.
- **`src/lib/env.ts`** — Zod-validated environment that fails at boot with a readable
  message. Each `NEXT_PUBLIC_*` var is referenced as a literal property access, because
  Next inlines those by textual substitution at build time and a computed lookup is
  silently `undefined` in the browser.
- **`src/lib/api/`** — fetch wrapper with timeout, `credentials: 'include'`, a UUIDv7
  `X-Request-Id` per call for log correlation (§13), and the §6.2 error taxonomy.
  Deliberately has **no retry logic**: booking is not idempotent.
- **Tailwind 4** CSS-first theme with light/dark tokens, plus a `Button` primitive.
- **Docker**: multi-stage build, non-root user, healthcheck at `/api/health`.

## What phase 2 delivered

- **Zod schemas** for auth, rides, search, bookings and cost — the contract source of
  truth until Express emits an OpenAPI spec, at which point `pnpm api:types` takes over.
- **Query key registry** (§5.2) and the **invalidation matrix as executable code**
  (`src/lib/query/invalidation.ts`), with tests asserting that every seat-affecting
  mutation invalidates search results.
- **MSW** handlers + named scenarios (`seatTaken`, `rideCompleted`, `forbidden`, …)
  shared by the test suite and the dev runtime, so a mock cannot drift from the
  contract without a test failing.
- **47 tests** pinning the invariants: bad-input rejection, contact invisibility,
  409-vs-410 distinction, and capability gating on terminal rides.

---

## Three things to know before you add code

**1. The server owns seats, money, and contact details.**
Never compute a seat count, a cost split, or contact visibility on the client. The UI
renders what the API returned. `driverContact` is `null` unless the caller holds a
confirmed booking — there is no `canViewContact` flag to get wrong, and revocation when
a driver cancels needs no client-side cleanup.

**2. A 409 on booking is a designed-for outcome, not an error.**
Two riders tap Book on the last seat; one gets 201, one gets 409. Handle it with a
recovery path (`isSeatConflict`), never a generic "Something went wrong" toast. And
never retry a booking POST — a retried non-idempotent write can double-book. If retry
safety is wanted, it belongs in the API contract as an `Idempotency-Key`, not here.

**3. Import features from their root.**
`@/features/bookings`, never `@/features/bookings/components/BookingCard`. ESLint
enforces this. It is what lets a feature's internals be restructured without touching
the rest of the app.

## Layout

```
src/
├── app/         Routing only — no business logic
├── features/    Vertical slices; cross-feature imports go via index.ts
├── components/  Shared, feature-agnostic UI
├── lib/         api · query · geo · auth · env · logger · utils
├── config/      site metadata, tunable constants
├── mocks/       Fixtures + MSW handlers (used by tests AND dev runtime)
├── test/        Vitest setup
└── types/       Generated API types (do not hand-edit)
```

## Environment

| Variable | Scope | Notes |
|---|---|---|
| `API_URL` | server | Internal Express address (`http://api:4000` in compose) |
| `SESSION_SECRET` | server | ≥32 chars. `openssl rand -base64 32` |
| `NEXT_PUBLIC_API_URL` | browser | Inlined at **build** time — never a secret |
| `NEXT_PUBLIC_MAP_STYLE_URL` | browser | Optional until phase 5 |
| `NEXT_PUBLIC_ENABLE_MSW` | browser | `true` runs the UI with no backend |

## Next: phase 3 (Auth)

Login/register, the cookie-setting BFF route handlers under `src/app/api/auth/`,
`getSession()`, `middleware.ts`, and the authenticated app shell. Done when protected
routes redirect and a session survives a refresh (§16).

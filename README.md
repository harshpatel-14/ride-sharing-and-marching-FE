# Ride Sharing & Matching — Frontend

React 19 · Next.js 16 (App Router) · TypeScript (strict) · TanStack Query · Zod · Tailwind 4

The architecture this implements is in [FRONTEND-ARCHITECTURE.md](./FRONTEND-ARCHITECTURE.md).
Section references below (§) point there. The product spec is
[21-ride-sharing-and-matching.md](./21-ride-sharing-and-matching.md).

**Status: phases 1–6 complete** — foundation, contract, auth, rides, search and booking —
built against the real backend contract in [docs/API.md](docs/API.md). Phase 7 (hardening:
Playwright, Sentry, perf budgets, a11y pass) is outstanding.

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

## What phase 4 delivered

- **Post a ride** — `RideForm`, React Hook Form + Zod, with a separate form-shaped
  schema (`rideFormSchema`) that maps to the wire type in exactly one place
  (`toCreateRideInput`). Rejects past departures, zero/fractional seats and identical
  origin/destination before any request goes out, and maps backend field errors back
  onto the right input.
- **Ride detail** — RSC prefetch to client hydration, then polled while the tab is
  focused so the seat count stays honest.
- **My rides** — prefetched list with an empty state.
- **The completed lock** — a terminal ride renders a read-only explanation and its
  destructive actions are absent, not disabled.
- **Contact panel** — renders if and only if the server sent `driverContact`.
- **Confirmation dialogs** for cancel and complete, both irreversible.
- **48 new tests** (95 total), including a mutation check: contact visibility,
  the completed lock and the cancel-ride invalidation were each deliberately broken,
  and the suite failed in exactly the right places.

### Money is parsed exactly, never through a float

People type rupees; the API takes integer paise. `parseMajorToMinor` splits the string
rather than multiplying, because `1200.55 * 100` is `120054.99999999999` before
rounding. That figure feeds a cost split that has to reconcile with an audit trail,
so being off by a paisa is not cosmetic (§11).

### Phase 3 status

Phase 4 needs a session to exist, so the plumbing is in: `getSession()` /
`requireSession()` (`@/features/auth/server`), the `(app)` shell that guards every
route under it, and the BFF `GET /api/auth/me` passthrough. Verified against a stub
backend: when `/auth/me` fails, `/rides/mine` returns `307 -> /login` and leaks no
ride data.

**Still outstanding in phase 3:** the login and register forms, the cookie-*setting*
routes (`/api/auth/login`, `/register`, `/logout`, `/refresh`), and `middleware.ts`.
`/login` does not exist yet, so that redirect currently lands on a 404.

---

## Built against the real API

The contract lives in [docs/API.md](docs/API.md) and [docs/FRONTEND.md](docs/FRONTEND.md).
Five things there shape most of this codebase:

| Backend rule | What it forces here |
|---|---|
| Money is a **decimal string** (`"320.00"`) | `lib/utils/money.ts` formats and compares strings; nothing calls `Number()` on an amount |
| Refresh tokens are **single-use**, and concurrent reuse revokes every session | single-flight lock **plus** a rotation grace cache in `auth.server.ts` |
| There is **no 403** — not-yours returns `404` | one message for both; the UI is never an existence oracle |
| `driver.phone` is **absent** until a booking is confirmed | `hasContact()` type guard; no `canViewContact` flag anywhere |
| `409 NO_SEATS_AVAILABLE` is a **normal** outcome | a recovery path, never a generic error toast |

### Money never becomes a float

`Intl.NumberFormat.format` accepts a decimal string and formats it exactly, so amounts render
without a `Number()` in the path. `Number("1200.55")` is `1200.5500000000001`, and that figure
feeds a cost split which has to reconcile with an audit trail to the paisa.

### The refresh trap, and what it took to close it

A refresh token is single-use, and the backend treats a replay as theft — it revokes **every**
session. A single-flight lock is the obvious fix and it is **not sufficient**. A ten-way
concurrency test against a stub backend produced **5 refresh calls and a reuse flag**: requests
arriving just *after* a refresh completed still carried the spent token in their cookie, because
the rotated cookie had not reached the client yet. That is what parallel browser XHRs do.

The fix is a short grace cache keyed by the token that was spent, so a replay within 30 seconds
gets the same rotated pair back instead of asking again. Re-measured: **10/10 requests succeed,
1 refresh call, no reuse flagged**.

*Trade-off:* inside that window a replay gets the cached pair rather than tripping the backend's
theft detection. Acceptable because the token lives in an httpOnly cookie only this BFF reads.
*Limit:* the lock is per process — see **Scaling out** below.

## What phases 5 and 6 delivered

**Search.** URL-state search, so a link reproduces the screen exactly — which is also how you
reproduce a slow query at 10 000 open rides. Results lead with `estimatedShare` (what this
rider would pay), never `estimatedCost` (the whole ride). Nothing filters or re-sorts
client-side. The empty state explains that matching needs *both* endpoints near *and* the
windows to overlap, because "no results" is the most confusing screen here.

**Geocoding** is a swappable adapter. Unset `NEXT_PUBLIC_GEOCODER_URL` and the place picker
degrades to manual coordinates, which produce the identical wire payload.

**Map** renders from the same array as the list, so the panes cannot disagree. Dynamically
imported, never server-rendered, and entirely optional.

**Booking** centres on the 409. Losing the last seat gets a recovery dialog — the seat went,
nothing was charged, here is a similar ride — not an error toast. The seat count is never
optimistically decremented and no booking POST is ever retried.

**Cancelled bookings stay visible**, with `seatShare` and `amountOwed` shown separately so
"was quoted 150, then the driver cancelled" stays distinguishable from "paid 150".

### Verified end to end, not just in jsdom

Against a stub implementing docs/API.md, through the real BFF:

| Check | Result |
|---|---|
| Two riders race the last seat | exactly one 201, one 409 `NO_SEATS_AVAILABLE` |
| Contact details after booking | winner sees phone+email; loser's page leaks neither |
| Full ride in search | drops out |
| Cost split on cancel | ₹300 → 150/150 → back to 300; quoted share kept, owed → 0.00 |
| Driver cancels ride | rider's page shows reason, "owe nothing", route forward |
| Manifest read by a non-driver | 404 |
| 10 parallel calls on an expired token | 1 refresh, no reuse flagged |

## Three things to know before you add code

**1. The server owns seats, money, and contact details.**
Never compute a seat count, a cost split, or contact visibility on the client. `driver` simply
lacks `phone`/`email` unless the caller is the driver or holds a confirmed booking — the backend
does not fetch those columns otherwise. Use `hasContact(ride.driver)`; there is no
`canViewContact` flag to get wrong, and revocation on cancellation needs no client-side cleanup.

**2. `409 NO_SEATS_AVAILABLE` is a designed-for outcome, not an error.**
Two riders tap Book on the last seat; one gets 201, one gets 409. Handle it with
`isSeatUnavailable()` and a recovery path, never a generic "Something went wrong". Never retry a
booking POST — a retried non-idempotent write can claim a second seat. Do not optimistically
decrement `seatsAvailable`: you cannot know you won.

**3. Import features from their root.**
`@/features/bookings`, never `@/features/bookings/components/BookingCard`. ESLint
enforces this. It is what lets a feature's internals be restructured without touching
the rest of the app.

## Scaling out

The refresh lock and grace cache are **per process**. Two Next instances behind a load balancer
could still race and trip the backend's reuse detection. Before running more than one instance,
either move both to a shared store (Redis) or pin refresh to a single sticky route.

## Layout

```
src/
├── app/         Routing only — no business logic
├── features/    Vertical slices; cross-feature imports go via index.ts
├── components/  Shared, feature-agnostic UI
├── lib/         api · query · geo · auth · env · logger · utils
├── config/      site metadata, tunable constants
├── mocks/       Fixtures + MSW handlers (used by tests AND dev runtime)
│                 shaped from the real payloads in docs/API.md
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

## Corrections to FRONTEND-ARCHITECTURE.md

Found while building against the real contract; worth folding back into the doc:

1. **§2 files `getSession()` under `lib/auth/`, which its own §3 table forbids** — it needs
   the auth schemas, and `lib` may not import `features`. Session handling now lives in
   `features/auth/api/auth.server.ts`, and the layering rule stands unweakened.
2. **Features need a second entry point.** `index.ts` alone cannot serve both Client and Server
   Components. Each feature may also expose `server.ts` (RSC-only); ESLint allows exactly those
   two and nothing deeper.
3. **§11's integer-minor-units advice is wrong for this backend.** The API uses decimal strings.
   The principle (never a float) survives; the representation changed.
4. **§6.2's status table needs revising** — this API has no 403 and no 410. Not-yours is 404,
   and a completed ride is `409 RIDE_COMPLETED_IMMUTABLE`.
5. **The search contract differs:** metres not kilometres, a 24-hour window cap, ranked top-N
   with no cursor, and `estimatedShare` is what to display rather than `estimatedCost`.

## Next: phase 5 (Search) and phase 6 (Booking)

`PlaceField` is already shaped in the provider-neutral `Place` vocabulary, so swapping its
innards for a geocoder autocomplete will not ripple into the ride form. The search and booking
schemas and API clients are already written against the contract — what remains is their UI.

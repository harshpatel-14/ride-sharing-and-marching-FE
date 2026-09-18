# Frontend Architecture — Ride Sharing & Matching

**Stack:** React 19 · Next.js 15 (App Router) · TypeScript (strict) · TanStack Query · Zod · Tailwind + shadcn/ui
**Backend (separate service):** Node · Express · PostgreSQL · Prisma

This document is the frontend contract. It is written to survive past the 2-week POC: the
boundaries below are the ones that get expensive to move later. Everything inside a boundary is
meant to be cheap to rewrite.

---

## 0. The three architectural commitments

Everything else in this document follows from these. If you change one, re-read the rest.

1. **The server is the only source of truth for seats, money, and contact details.**
   The frontend never computes a seat count, never computes a cost split, and never decides
   whether contact details are visible. It renders what the API returned. This is not a style
   preference — §3.3, §3.5 and §3.7 of the spec are all server-enforced invariants, and any
   frontend that mirrors that logic will eventually disagree with the database and show a rider
   a seat that isn't there.

2. **Next.js is a BFF, not the backend.** Express owns business logic. Next owns session
   cookies, request shaping, caching, and rendering. No Prisma import ever appears in this repo.
   This keeps the Express API independently testable (the POC is graded on API-level tests) and
   lets you put a mobile client on the same API later without refactoring.

3. **Features are vertical slices.** A feature owns its components, hooks, schemas, and API
   calls in one directory. Cross-feature imports go through a feature's public `index.ts` only.
   This is the single rule that keeps a codebase navigable at 200 files.

---

## 1. Tech stack, and why each piece

| Concern | Choice | Why this and not the obvious alternative |
|---|---|---|
| Framework | Next.js 15, App Router | RSC lets search results and ride detail render on the server with the session cookie attached — no loading spinner on first paint, no token in JS. Pages Router is maintenance-mode for new work. |
| Language | TypeScript, `strict: true` + `noUncheckedIndexedAccess` | Non-negotiable for a long-lived codebase. |
| Server state | TanStack Query v5 | Booking/cancel are mutations with invalidation fan-out (ride, my-bookings, search results). Hand-rolled `useEffect` fetching cannot express that. |
| Client state | Zustand, sparingly | Only for genuinely client-owned state (search draft, map viewport, toasts). Most "state" here is server state — do not put it in Zustand. |
| URL state | `nuqs` (or hand-rolled `useSearchParams` helpers) | Search filters live in the URL. A shareable/back-button-able search result is a product requirement in disguise. |
| Validation | Zod | One schema validates the form *and* parses the API response. See §5.3. |
| Forms | React Hook Form + `zodResolver` | Uncontrolled by default; the ride-posting form has enough fields that re-render cost matters. |
| Styling | Tailwind CSS + shadcn/ui | shadcn copies components into your repo — you own them, no upgrade treadmill, no fighting a component library's opinions on a date-time picker. |
| Dates | `date-fns` + `@date-fns/tz` | Departure times are timezone-sensitive. Never use raw `Date` arithmetic for the time-window overlap display. |
| Maps | Adapter over MapLibre GL + a geocoder | Wrapped behind `lib/geo/` so swapping Mapbox → Google → MapLibre is one file. See §8. |
| Tests | Vitest + RTL + Playwright + MSW | See §12. |
| Lint | ESLint flat config + `eslint-plugin-boundaries` | The boundaries plugin *mechanically enforces* §3's layering. A rule you can't enforce is a suggestion. |

**Deliberately not included:** Redux (server state dominates), tRPC (your API is Express and must
stay language-agnostic), a GraphQL layer (one client, no over-fetching problem yet).

---

## 2. Directory structure

```
src/
├── app/                              # Routing ONLY. No business logic lives here.
│   ├── (marketing)/
│   │   ├── page.tsx                  # Landing
│   │   └── layout.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── layout.tsx                # Centered card shell
│   ├── (app)/                        # Authenticated shell
│   │   ├── layout.tsx                # Session guard + app chrome
│   │   ├── search/
│   │   │   ├── page.tsx              # RSC: reads searchParams, calls API, streams results
│   │   │   ├── loading.tsx
│   │   │   └── error.tsx
│   │   ├── rides/
│   │   │   ├── new/page.tsx          # Driver: post a ride
│   │   │   └── [rideId]/
│   │   │       ├── page.tsx          # Ride detail (contact block conditional on server payload)
│   │   │       ├── manage/page.tsx   # Driver-only: bookings on this ride
│   │   │       └── not-found.tsx
│   │   ├── bookings/
│   │   │   ├── page.tsx              # Rider: my bookings
│   │   │   └── [bookingId]/page.tsx
│   │   └── dashboard/page.tsx
│   ├── api/                          # BFF route handlers ONLY (see §4)
│   │   ├── auth/[...action]/route.ts # login/logout/refresh — sets httpOnly cookies
│   │   └── proxy/[...path]/route.ts  # Optional passthrough for client-side mutations
│   ├── layout.tsx                    # Root: providers, fonts, <html>
│   ├── global-error.tsx
│   └── globals.css
│
├── features/                         # Vertical slices. The heart of the codebase.
│   ├── auth/
│   │   ├── api/                      # auth.api.ts, auth.keys.ts
│   │   ├── components/               # LoginForm, RegisterForm, UserMenu
│   │   ├── hooks/                    # useSession, useLogin, useLogout
│   │   ├── schemas/                  # loginSchema, sessionSchema
│   │   ├── types.ts
│   │   └── index.ts                  # PUBLIC API — the only legal import path
│   ├── rides/
│   │   ├── api/                      # rides.api.ts, rides.keys.ts
│   │   ├── components/               # RideCard, RideForm, RideDetail, SeatBadge, CompletedLock
│   │   ├── hooks/                    # useRide, useCreateRide, useCancelRide, useCompleteRide
│   │   ├── schemas/                  # createRideSchema (shared shape w/ BE contract)
│   │   ├── lib/                      # pure helpers: formatRoute, rideStatusLabel
│   │   └── index.ts
│   ├── search/
│   │   ├── api/                      # search.api.ts
│   │   ├── components/               # SearchForm, ResultList, ResultMap, EmptyState
│   │   ├── hooks/                    # useSearchParamsState, useSearchRides
│   │   ├── schemas/                  # searchQuerySchema (parses AND serializes URL params)
│   │   └── index.ts
│   ├── bookings/
│   │   ├── api/
│   │   ├── components/               # BookSeatButton, BookingCard, CancelBookingDialog
│   │   ├── hooks/                    # useBookSeat, useCancelBooking, useMyBookings
│   │   ├── schemas/
│   │   └── index.ts
│   └── cost/
│       ├── components/               # CostSplitPanel, ShareBreakdown
│       ├── lib/                      # formatMoney ONLY — no split arithmetic (see §0.1)
│       └── index.ts
│
├── components/                       # Shared, feature-agnostic
│   ├── ui/                           # shadcn primitives (button, dialog, input, ...)
│   ├── layout/                       # AppShell, Header, Nav, Footer
│   └── feedback/                     # ErrorBoundary, EmptyState, Spinner, Toaster
│
├── lib/
│   ├── api/
│   │   ├── client.ts                 # fetch wrapper: base URL, credentials, timeout, retry
│   │   ├── server.ts                 # RSC-side client: forwards cookies from next/headers
│   │   ├── errors.ts                 # ApiError, isConflict(), isForbidden(), toUserMessage()
│   │   └── endpoints.ts              # Single map of every API path. One file to grep.
│   ├── query/
│   │   ├── client.ts                 # QueryClient factory + defaults
│   │   ├── keys.ts                    # Root key registry (see §5.2)
│   │   └── hydration.tsx             # RSC prefetch → client hydration helper
│   ├── geo/                          # Map/geocoding adapter (see §8)
│   │   ├── types.ts                  # LatLng, Place, BoundingBox — provider-neutral
│   │   ├── provider.ts               # Interface: geocode, reverseGeocode, distance
│   │   └── maplibre/                 # The one implementation
│   ├── auth/
│   │   ├── session.ts                # getSession() for RSC — reads cookie, calls /me
│   │   └── guards.ts                 # requireSession(), requireRole()
│   ├── env.ts                        # Zod-validated process.env. Fails at boot, not runtime.
│   ├── logger.ts                     # Structured client + server logging (§13)
│   └── utils/                        # cn(), formatDate(), assertNever()
│
├── config/
│   ├── site.ts                       # Name, nav items, metadata
│   └── constants.ts                  # Pagination sizes, radius presets, poll intervals
│
├── types/
│   └── api.d.ts                      # GENERATED from BE OpenAPI. Never hand-edited. (§5.1)
│
├── test/
│   ├── msw/                          # handlers/, server.ts, browser.ts
│   ├── factories/                    # ride.factory.ts, booking.factory.ts
│   └── setup.ts
│
└── middleware.ts                     # Edge: cookie presence check + redirect. Nothing more.
```

**The `index.ts` rule.** `features/bookings/components/BookingCard.tsx` may never be imported
directly from outside `features/bookings/`. Import from `@/features/bookings`. This is enforced
by `eslint-plugin-boundaries`, not by discipline. It means you can restructure a feature's
internals freely, forever, without touching the rest of the app.

---

## 3. Layering rules (mechanically enforced)

```
app/  ──────▶  features/  ──────▶  lib/  ──────▶  types/
  │                 │                 ▲
  └────▶ components/ ┘─────────────────┘
```

| Layer | May import from | May NOT import from |
|---|---|---|
| `app/` | `features/`, `components/`, `lib/`, `config/` | another route's internals |
| `features/*` | `components/`, `lib/`, `config/`, `types/`, other features **via their `index.ts` only** | `app/` |
| `components/` | `lib/`, `config/`, `types/` | `features/`, `app/` |
| `lib/` | `types/`, `config/` | everything above |

A shared component that needs to know about rides is not a shared component — it belongs in
`features/rides/`. This is the rule that stops `components/` from becoming a junk drawer, which
is the single most common way a React codebase becomes unmaintainable.

`.eslintrc` boundaries config:

```js
// eslint.config.js (excerpt)
{
  settings: {
    'boundaries/elements': [
      { type: 'app',        pattern: 'src/app/**' },
      { type: 'feature',    pattern: 'src/features/*', capture: ['name'] },
      { type: 'shared-ui',  pattern: 'src/components/**' },
      { type: 'lib',        pattern: 'src/lib/**' },
    ],
  },
  rules: {
    'boundaries/element-types': ['error', {
      default: 'disallow',
      rules: [
        { from: 'app',       allow: ['feature', 'shared-ui', 'lib'] },
        { from: 'feature',   allow: ['shared-ui', 'lib', ['feature', { name: '*' }]] },
        { from: 'shared-ui', allow: ['lib'] },
        { from: 'lib',       allow: ['lib'] },
      ],
    }],
    // Forbid reaching into a feature's internals
    'boundaries/entry-point': ['error', {
      default: 'disallow',
      rules: [{ target: ['feature'], allow: 'index.ts' }],
    }],
  },
}
```

---

## 4. Auth & the BFF boundary

**Model:** Express issues a short-lived access token + a refresh token. The browser never sees
either. Next's route handlers hold them in `httpOnly`, `secure`, `sameSite=lax` cookies.

Why not store a JWT in `localStorage`: it is readable by any XSS, and §6 of the spec requires
that every ride/booking/cancellation is tied to a real authenticated user — a stealable token
undermines that claim. Why not `sameSite=strict`: it breaks returning to the app from an email
link, which you will want for booking confirmations.

```
Browser ──(httpOnly cookie)──▶ Next route handler / RSC ──(Bearer)──▶ Express ──▶ Postgres
```

**Three enforcement points, none of them sufficient alone:**

| Where | What it does | What it does NOT do |
|---|---|---|
| `middleware.ts` | Redirects to `/login` if the session cookie is absent. Edge, fast, cheap. | Does not validate the token. Never decide authorization here. |
| `(app)/layout.tsx` | Calls `requireSession()` — real `/me` call, real validation. | Does not check resource ownership. |
| Express | Owns ownership checks: "is this your booking / your ride". | — |

The frontend's *only* job in authorization is to not render buttons the user can't use. It is a
UX affordance, never a security control. §6 of the spec asks you to prove ownership enforcement
with an API test, not a UI check — that is the same statement as this paragraph.

```ts
// src/lib/auth/session.ts
import { cache } from 'react'
import { cookies } from 'next/headers'
import { serverApi } from '@/lib/api/server'
import { sessionSchema } from '@/features/auth'

// cache() dedupes across all RSCs in one request — one /me call per page render.
export const getSession = cache(async () => {
  const token = (await cookies()).get('session')?.value
  if (!token) return null
  try {
    return sessionSchema.parse(await serverApi.get('/auth/me'))
  } catch {
    return null
  }
})

export async function requireSession() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}
```

**Role handling.** Driver and rider are capabilities of one user, not separate accounts — the
same person posts a ride on Monday and books one on Tuesday. Model it as
`session.capabilities: ('drive' | 'ride')[]`, not `session.role: 'driver' | 'rider'`. Getting
this wrong on day 3 costs a schema migration and a week of conditional rewrites.

---

## 5. Data layer

### 5.1 Contract generation — do this on day 1

Have the Express app emit an OpenAPI spec (`zod-to-openapi` on top of your existing Zod
validators is the least-effort path, and you need those validators anyway for §6's bad-input
requirement). Then:

```jsonc
// package.json
"scripts": {
  "api:types": "openapi-typescript ../backend/openapi.json -o src/types/api.d.ts"
}
```

`src/types/api.d.ts` is generated and gitignored-from-editing (commit it, but never hand-edit).
The payoff: the day the backend renames `seatsAvailable` → `availableSeats`, the frontend build
breaks in CI instead of the UI silently showing `undefined` seats. Over a long-lived project
this one script prevents more bugs than any amount of careful review.

### 5.2 Query key registry

Cache invalidation is where booking/cancel flows go wrong. Centralize the keys so an
invalidation can never miss a consumer.

```ts
// src/lib/query/keys.ts
export const queryKeys = {
  session: ['session'] as const,

  rides: {
    all:     ['rides'] as const,
    detail:  (id: string) => ['rides', 'detail', id] as const,
    mine:    () => ['rides', 'mine'] as const,
    bookings:(rideId: string) => ['rides', rideId, 'bookings'] as const,
  },

  search: {
    all:     ['search'] as const,
    results: (q: SearchQuery) => ['search', 'results', q] as const,
  },

  bookings: {
    all:    ['bookings'] as const,
    mine:   () => ['bookings', 'mine'] as const,
    detail: (id: string) => ['bookings', 'detail', id] as const,
  },
} as const
```

**Invalidation matrix** — the table that keeps the UI honest:

| Mutation | Must invalidate |
|---|---|
| Book a seat | `rides.detail(rideId)`, `search.all`, `bookings.mine()`, `rides.bookings(rideId)` |
| Cancel a booking | same set — seat returns immediately (§3.4), cost split changes (§3.5) |
| Driver cancels ride | `rides.all`, `search.all`, `bookings.mine()` |
| Complete a ride | `rides.detail(rideId)`, `rides.mine()` |
| Post a ride | `rides.mine()`, `search.all` |

Note that `search.all` is invalidated by every seat-affecting mutation. Search results embed
seat counts; a stale result list is exactly the "seats promised twice" problem the spec opens
with, reproduced in a new medium.

### 5.3 Runtime response validation

TypeScript types vanish at runtime. Parse every response at the boundary:

```ts
// src/features/rides/api/rides.api.ts
import { api } from '@/lib/api/client'
import { rideSchema, rideListSchema } from '../schemas'

export const ridesApi = {
  getById: async (id: string) => rideSchema.parse(await api.get(`/rides/${id}`)),
  listMine: async ()          => rideListSchema.parse(await api.get('/rides/mine')),
  create:   async (input: CreateRideInput) =>
    rideSchema.parse(await api.post('/rides', createRideSchema.parse(input))),
}
```

Cost: a few ms per response. Benefit: a backend contract drift surfaces as a loud, located,
attributable error instead of a `Cannot read properties of undefined` three components deep.

### 5.4 RSC prefetch → client hydration

Render server-side with data already present, then let TanStack Query take over for mutations.

```tsx
// app/(app)/rides/[rideId]/page.tsx
export default async function RideDetailPage({ params }) {
  const { rideId } = await params
  const qc = makeQueryClient()
  await qc.prefetchQuery({
    queryKey: queryKeys.rides.detail(rideId),
    queryFn: () => serverRidesApi.getById(rideId),
  })
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <RideDetail rideId={rideId} />
    </HydrationBoundary>
  )
}
```

**Rule of thumb for RSC vs client:** if it reads, make it a Server Component. If it writes or
responds to input within 100ms, make it a Client Component. Push `'use client'` as far down the
tree as it will go — a `'use client'` on a page layout silently converts the whole subtree.

---

## 6. The booking flow — where this app is actually hard

§3.3 is the sharpest requirement in the spec, and it has a specific frontend consequence:
**`409 Conflict` is a normal, expected, designed-for outcome, not an error.**

Two riders tap "Book" on the last seat. One gets `201`. One gets `409`. The one who gets `409`
must see something coherent, not a red toast saying "Something went wrong."

### 6.1 Do NOT optimistically update the seat count

This is the one place where the standard optimistic-UI advice is wrong. Decrementing seats
locally shows the rider a successful booking that the database may be about to reject. Instead:

- Disable the button and show in-flight state (this *is* optimistic UI — of the intent, not the
  outcome).
- On success: confirm, then invalidate.
- On `409`: refetch the ride, show the real seat count, offer alternatives.

```ts
// src/features/bookings/hooks/useBookSeat.ts
export function useBookSeat(rideId: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (input: BookSeatInput) => bookingsApi.create(rideId, input),

    onSuccess: (booking) => {
      // Contact details are now legitimately visible (§3.7) — but we don't
      // synthesize them, we refetch and let the server decide what to include.
      void qc.invalidateQueries({ queryKey: queryKeys.rides.detail(rideId) })
      void qc.invalidateQueries({ queryKey: queryKeys.search.all })
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.mine() })
      toast.success('Seat confirmed')
      router.push(`/bookings/${booking.id}`)
    },

    onError: async (err) => {
      if (isConflict(err)) {
        // Expected path, not a failure. Show truth, then a way forward.
        await qc.invalidateQueries({ queryKey: queryKeys.rides.detail(rideId) })
        openSeatTakenDialog({ rideId })   // "That seat just went. 3 similar rides →"
        return
      }
      if (isGone(err)) { toast.error('This ride was cancelled by the driver.'); return }
      toast.error(toUserMessage(err))
    },

    retry: false,  // NEVER auto-retry a booking. Retrying a POST can double-book.
  })
}
```

`retry: false` on every seat-affecting mutation is load-bearing. TanStack Query's default retry
on a network timeout would fire a second booking request for a request that may have succeeded.
If you want retry safety, ask the backend for an `Idempotency-Key` header — that is the correct
fix, and it belongs in the API contract, not in client retry logic.

### 6.2 Error taxonomy

Map backend status codes to frontend behaviour once, in `lib/api/errors.ts`:

| Status | Meaning here | UI |
|---|---|---|
| 400 | Bad input (past departure, zero seats) | Inline field errors from the response body |
| 401 | Session expired | Silent refresh, then retry once; else → `/login` |
| 403 | Not your booking / not your ride | "You don't have access to this" — no detail leak |
| 404 | Ride/booking doesn't exist | `not-found.tsx` |
| 409 | **Last seat taken** / already booked | Seat-taken dialog + alternatives (§6.1) |
| 410 | Ride cancelled or completed | Read-only state with explanation (§3.6) |
| 422 | Semantic rejection | Form-level error |

403 and 404 should be visually indistinguishable to the user where the resource belongs to
someone else — otherwise the UI becomes an existence oracle for other people's bookings.

### 6.3 Keeping seat counts fresh

Three options, in increasing order of cost. Pick per the POC's timeline:

1. **Polling with `refetchInterval`** on the ride detail page (5s while the tab is focused,
   paused when hidden via `refetchIntervalInBackground: false`). Ship this first. It is one
   line and it is honest.
2. **SSE** from Express (`GET /rides/:id/events`) pushing seat changes. Clean fit for one-way
   updates, works through proxies, no extra infrastructure. This is the right long-term answer.
3. **WebSockets.** Only if you add driver↔rider chat later. Don't pay for it now.

Design the hook so the swap is invisible: `useRideLiveSeats(rideId)` returns seat count and
freshness, and the transport is its implementation detail.

---

## 7. Search & matching — the frontend's discipline

§3.2 says matching is a real database query. The frontend's job is to **not undermine that**.

**Forbidden in this codebase:**
- Fetching all rides and filtering in JS.
- Re-sorting a paginated result set client-side (it reorders across page boundaries and lies).
- Computing distance client-side to decide what to show. Compute it only to *label* what the
  server already returned ("2.1 km from your pickup").

**Search state lives in the URL.** `/search?originLat=..&originLng=..&destLat=..&destLng=..&departAfter=..&departBefore=..&radiusKm=10`

```ts
// src/features/search/schemas/search-query.schema.ts
export const searchQuerySchema = z.object({
  originLat:  z.coerce.number().min(-90).max(90),
  originLng:  z.coerce.number().min(-180).max(180),
  destLat:    z.coerce.number().min(-90).max(90),
  destLng:    z.coerce.number().min(-180).max(180),
  departAfter:  z.string().datetime(),
  departBefore: z.string().datetime(),
  radiusKm:   z.coerce.number().min(1).max(50).default(10),
  seats:      z.coerce.number().int().min(1).max(8).default(1),
  cursor:     z.string().optional(),
}).refine(v => new Date(v.departAfter) < new Date(v.departBefore), {
  message: 'Time window must start before it ends', path: ['departBefore'],
})

export type SearchQuery = z.infer<typeof searchQuerySchema>
```

This single schema does four jobs: validates the form, parses `searchParams` in the RSC,
serializes back to a query string, and types the API call. That is what "one source of truth"
buys you.

**Why URL state and not component state:** a rider can share a search, the back button works,
the RSC can render results on first paint with no client JS, and — importantly for your
walkthrough — you can paste a URL to reproduce a slow query against 10,000 open rides (§8 of
the spec).

**Pagination: cursor, not offset.** Open rides change continuously as people book. Offset
pagination duplicates and drops rows under concurrent writes. Use `useInfiniteQuery` with a
server cursor.

**UI structure:** a two-pane layout — filter form + result list on the left, map on the right,
synchronized by hovering a card highlighting a marker. Both panes render from the *same*
server-returned result array. The map never has its own data source.

---

## 8. The geo adapter

§4 of the spec leaves the origin/destination representation to you. The backend will likely land
on PostGIS `geography(Point)` with a GiST index, or a lat/lng pair with a bounding-box prefilter.
Either way, the **frontend must not encode that choice**.

```ts
// src/lib/geo/types.ts — provider-neutral, backend-neutral
export interface LatLng { lat: number; lng: number }
export interface Place  { id: string; label: string; coords: LatLng }

// src/lib/geo/provider.ts
export interface GeoProvider {
  search(query: string, near?: LatLng): Promise<Place[]>
  reverse(coords: LatLng): Promise<Place | null>
  distanceKm(a: LatLng, b: LatLng): number   // display labelling only
}
```

Everything above this interface speaks `LatLng` and `Place`. The MapLibre implementation, the
geocoder API key, and the tile provider are all details under `lib/geo/maplibre/`. When you
swap map providers in year two — and you will, on pricing — it is one directory.

`distanceKm` exists for labels. It must never gate what appears in a result list.

---

## 9. Contact visibility (§3.7)

The requirement: contact details appear only after a confirmed booking. The walkthrough question
is explicitly *"excluded at the query or filtered after?"* — and the frontend answer must be:
**neither, because the frontend never receives them.**

Model it in the type system so the wrong thing is unrepresentable:

```ts
// src/features/rides/schemas/ride.schema.ts
const contactSchema = z.object({ name: z.string(), phone: z.string() })

export const rideSchema = z.object({
  id: z.string().uuid(),
  origin: placeSchema,
  destination: placeSchema,
  departureAt: z.string().datetime(),
  seatsTotal: z.number().int(),
  seatsAvailable: z.number().int(),
  status: z.enum(['OPEN', 'FULL', 'CANCELLED', 'COMPLETED']),
  estimatedCostCents: z.number().int(),
  // Present ONLY when the caller holds a confirmed booking. The server decides.
  driverContact: contactSchema.nullable(),
})
```

`<ContactPanel />` renders if and only if `ride.driverContact !== null`. There is no
`canViewContact` boolean computed on the client — that would be a second implementation of an
authorization rule, and second implementations drift.

If you ever see contact details in a search response payload, that is a backend bug, and your
frontend test suite should assert their absence:

```ts
it('search results never carry contact details', async () => {
  const results = await searchApi.query(baseQuery)
  results.forEach(r => expect(r).not.toHaveProperty('driverContact'))
})
```

---

## 10. Completed & cancelled rides (§3.6)

A completed ride is immutable. The frontend expresses this as a **state machine on `ride.status`
returned by the server**, driving a capability object:

```ts
// src/features/rides/lib/ride-capabilities.ts
export function rideCapabilities(ride: Ride, session: Session) {
  const isDriver = ride.driverId === session.userId
  const isTerminal = ride.status === 'COMPLETED' || ride.status === 'CANCELLED'
  return {
    canBook:   ride.status === 'OPEN' && ride.seatsAvailable > 0 && !isDriver,
    canCancel: !isTerminal && isDriver,
    canEdit:   !isTerminal && isDriver,
    canComplete: ride.status === 'OPEN' && isDriver && isPast(ride.departureAt),
  }
}
```

This is a *rendering* decision, not enforcement — §3.6 is enforced in Express and in the
database. The capability object exists so that "can this be booked?" has exactly one answer
across the card, the detail page, and the map popup, instead of three drifting conditionals.

**Driver cancels a whole ride** (§3.4) — the spec asks you to decide and document what riders
see. Documented decision:
- Affected bookings move to `CANCELLED_BY_DRIVER` (distinct from `CANCELLED_BY_RIDER` —
  different cause, potentially different refund/reputation handling later).
- The rider's booking card shows a persistent, non-dismissible banner with the reason and a
  "Find another ride" CTA prefilled with that booking's original route and time window.
- Contact details revoke immediately (booking is no longer confirmed → server stops returning
  them → panel disappears on next fetch, with no client-side cleanup needed).

That last bullet is the payoff of §9's design: revocation is automatic because visibility was
never client-owned.

---

## 11. Cost split (§3.5)

The frontend **displays** money. It never computes it.

```ts
export const costSplitSchema = z.object({
  totalCents: z.number().int(),
  confirmedRiderCount: z.number().int(),
  perRiderCents: z.number().int(),
  yourShareCents: z.number().int(),
  recalculatedAt: z.string().datetime(),
})
```

Reasons this is not negotiable, beyond §0.1:
- Integer division remainders (₹100 ÷ 3) must be allocated deterministically and identically to
  whatever the audit log records. Two implementations = two answers = a dispute you lose.
- §6 requires a structured trace "if a rider disputes what they were actually charged." That
  trace is the backend's calculation. A client-side number that differs by one paisa makes the
  trace worthless as evidence.

Store money as integer minor units (cents/paise) end to end. Never floats. Format at the edge:

```ts
export const formatMoney = (cents: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(cents / 100)
```

Show the split as a live-updating panel on the ride detail page, with `recalculatedAt` surfaced
so a rider can see that their share moved *because* someone cancelled, not arbitrarily.

---

## 12. Testing strategy

The POC is graded on tests. Most of the sharp ones (concurrency, ownership) belong to the
backend — but the frontend has its own obligations.

| Layer | Tool | What it covers | Target |
|---|---|---|---|
| Unit | Vitest | Schemas, capabilities, formatters, URL serialization | Every `lib/` and `features/*/lib/` |
| Component | RTL + MSW | Forms, error states, conditional rendering | Booking, search form, contact panel |
| Integration | RTL + MSW | Full flows against mocked API | Search → book → cancel |
| E2E | Playwright | Critical paths against a real stack | 4–6 specs, no more |

**MSW is the keystone.** Handlers live in `test/msw/handlers/` and are derived from the same
generated OpenAPI types as the real client — so a backend contract change breaks the mocks too,
instead of leaving you with a green test suite mocking an API that no longer exists. This is the
single highest-leverage testing decision in the document.

**The frontend tests that matter most here:**

```ts
// The 409 path — the spec's sharpest requirement, seen from the client
it('shows seat-taken recovery when the last seat is lost', async () => {
  server.use(http.post('*/rides/:id/bookings', () =>
    HttpResponse.json({ code: 'SEAT_UNAVAILABLE' }, { status: 409 })))

  render(<BookSeatButton rideId="r1" />)
  await user.click(screen.getByRole('button', { name: /book/i }))

  expect(await screen.findByRole('dialog', { name: /seat.*taken/i })).toBeVisible()
  expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument()
})

it('never sends a second booking request on network failure', async () => {
  let calls = 0
  server.use(http.post('*/rides/:id/bookings', () => { calls++; return HttpResponse.error() }))
  render(<BookSeatButton rideId="r1" />)
  await user.click(screen.getByRole('button', { name: /book/i }))
  await waitFor(() => expect(calls).toBe(1))   // retry: false, asserted
})

it('hides contact details until a booking is confirmed', async () => {
  renderRideDetail({ driverContact: null })
  expect(screen.queryByText(/phone/i)).not.toBeInTheDocument()
})
```

**Playwright E2E — exactly these:** register→login→post a ride; search returns a
proximity+time match; book a seat end to end; two browser contexts racing the last seat
(the frontend half of the spec's headline test); driver cancels and the rider sees the banner.

---

## 13. Observability

§6 requires a structured trace for every ride posting, booking, cancellation, and cost
recalculation. That trace is authored by the backend — the frontend's contribution is
**correlation**.

- Generate a `X-Request-Id` (UUID v7) per outbound request in `lib/api/client.ts`. Log it
  client-side, and the backend logs it alongside its own trace. One ID joins a user's "I clicked
  book and nothing happened" to the exact database transaction.
- Structured client logging: `logger.info('booking.attempt', { rideId, requestId })`. Never
  `console.log` a bare string — a string can't be queried.
- **Never log:** contact details, tokens, or exact coordinates of a home address. Coordinates are
  personal data; log a geohash at ~1km precision if you need them for debugging.
- Error boundaries at three levels: `global-error.tsx` (root), per-route `error.tsx`, and
  component-level for the map (which fails independently and shouldn't take the result list down).
- Wire Sentry (or equivalent) with the request ID attached as a tag. Do this in week 1 — after
  launch, you'll be debugging blind exactly when you can least afford it.

---

## 14. Performance

- **Route-level code splitting** is automatic. Additionally `next/dynamic` the map bundle
  (MapLibre is ~200KB gzipped) with `ssr: false` and a skeleton.
- **Virtualize** the search result list (`@tanstack/react-virtual`) beyond ~50 rows. At 10,000
  open rides (spec §8) a naive list will drop frames while the query plan is the thing under
  discussion.
- **Debounce** geocoder input at 300ms, and cancel in-flight requests with `AbortController`.
  Geocoding is usually billed per request.
- **Streaming SSR** with `<Suspense>` — render the search form and page chrome immediately,
  stream the result list when the query returns. The matching query is the slow part; don't let
  it block first paint.
- **Budgets, enforced in CI:** LCP < 2.5s, CLS < 0.1, initial JS < 200KB gzipped. Use
  `@next/bundle-analyzer` and fail the build on regression. A budget that isn't enforced is a
  wish.

---

## 15. Environment & Docker

```ts
// src/lib/env.ts — fails at boot, not at 2am in production
import { z } from 'zod'

const server = z.object({
  API_URL: z.string().url(),                  // internal: http://api:4000
  SESSION_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'test', 'production']),
})
const client = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),      // browser-facing
  NEXT_PUBLIC_MAP_STYLE_URL: z.string().url(),
  NEXT_PUBLIC_GEOCODER_KEY: z.string().min(1),
})

export const env = { ...server.parse(process.env), ...client.parse(process.env) }
```

Only `NEXT_PUBLIC_*` reaches the browser — never put a server secret there, and note that
`NEXT_PUBLIC_*` values are **inlined at build time**, so they can't be changed by the runtime
environment. If you need runtime config, pass it through an RSC.

`docker-compose.yml` (frontend's share — §6 requires `docker compose up` and nothing else):

```yaml
services:
  web:
    build: { context: ./frontend, dockerfile: Dockerfile }
    ports: ["3000:3000"]
    environment:
      API_URL: http://api:4000
      NEXT_PUBLIC_API_URL: http://localhost:4000
    depends_on: { api: { condition: service_healthy } }
```

Use Next's `output: 'standalone'` with a multi-stage Dockerfile (deps → build → runner, non-root
user). It cuts the image from ~1.2GB to ~150MB.

---

## 16. Build order

Each phase ends with something demonstrable. Do not reorder 1 and 2 — the contract and the
boundaries are what make phases 3–6 fast.

| Phase | Scope | Done when |
|---|---|---|
| **1. Foundation** | Next scaffold, TS strict, ESLint boundaries, Tailwind + shadcn, `env.ts`, `lib/api`, Docker | `docker compose up` serves a styled page; a boundary violation fails lint |
| **2. Contract** | OpenAPI generation, `types/api.d.ts`, MSW handlers, Zod schemas, query keys | The whole UI can be built against MSW with the backend offline |
| **3. Auth** | Login/register, cookie BFF routes, `getSession`, middleware, app shell | Protected routes redirect; session survives refresh |
| **4. Rides** | Post a ride, ride detail, my rides, capabilities, completed lock | A driver can post and view a ride; a completed ride renders read-only |
| **5. Search** | URL-state search, geo adapter, result list + map, cursor pagination | A shared search URL reproduces results exactly |
| **6. Booking** | Book, 409 recovery, cancel, contact panel, cost split, invalidation matrix | The two-tab last-seat race shows one success and one recovery dialog |
| **7. Hardening** | Playwright specs, error boundaries, Sentry, perf budgets, a11y pass | CI green; budgets enforced; keyboard-navigable throughout |

---

## 17. Answers to the walkthrough questions (frontend half)

**Q: Show me the matching query.** — It isn't in this repo, by design. The frontend sends a
validated query-parameter set (`searchQuerySchema`) and renders the result array. `grep` for
`ALL_RIDES` or a client-side `.filter(` on ride lists and you'll find nothing; the ESLint
boundaries config and the absence of any bulk rides endpoint in `lib/api/endpoints.ts` are the
structural guarantee.

**Q: Contact details — excluded at the query or filtered after?** — From the frontend's side,
the field is absent from the payload entirely. `rideSchema.driverContact` is `nullable()`, the
panel renders on non-null, and a test asserts search responses never carry the property. There
is no client-side visibility rule to bypass.

**Q: Completed ride immutability — enforced where?** — Database and Express. The frontend's
`rideCapabilities()` only decides which buttons render. If someone POSTs directly to a completed
ride, they get 410 and the UI shows the read-only state; nothing about the enforcement depends
on the client.

---

## 18. Decisions to revisit later (not now)

Recorded so they don't get re-litigated mid-POC:

- **i18n.** Structure strings through a `t()` helper from day 1 even with one locale; retrofitting
  i18n across 200 components is a multi-week task.
- **Real-time transport.** Poll now, SSE at first sign of staleness complaints, WebSockets only
  if chat arrives.
- **Offline/PWA.** Riders use this on patchy mobile data. A service worker caching "my bookings"
  read-only is high value later; do not attempt writes offline (see §6.1 — you cannot queue a
  booking against a seat count you can't see).
- **Mobile app.** The BFF split (§0.2) already makes this possible without touching Express.
- **Design tokens.** shadcn's CSS variables are already a token layer; formalize into a package
  only when a second surface (mobile, email) needs them.

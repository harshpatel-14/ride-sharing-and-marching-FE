# Frontend Integration Guide

Written for whoever builds the client against this API. Pairs with
[API.md](API.md), which is the endpoint reference; this document covers the things
that are easy to get wrong.

---

## The five things that will bite you

1. **`estimatedCost` and `seatShare` are strings.** Never `Number(cost)`.
2. **A refresh token is single-use.** Reusing one logs the user out everywhere.
3. **Concurrent refreshes count as reuse.** You need a single-flight lock.
4. **`404` means "not found *or* not yours".** Do not show "deleted" — show "not available".
5. **`driver.phone` is absent until a booking is confirmed.** Not a bug; don't code around it.

---

## Types

Hand-written rather than generated — copy this into the client as-is.

```ts
export type RideStatus = 'OPEN' | 'CANCELLED' | 'COMPLETED';
export type BookingStatus = 'CONFIRMED' | 'CANCELLED_BY_RIDER' | 'CANCELLED_BY_DRIVER';

export interface Booking {
  id: string;
  rideId: string;
  riderId: string;
  status: BookingStatus;
  /** Decimal string. Changes whenever the confirmed rider set changes. */
  seatShare: string;
  /** "0.00" once cancelled — seatShare is kept as a record, not as a debt. */
  amountOwed: string;
  createdAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  ride?: Ride;
  rider?: PublicRider | RiderWithContact;
}

export interface PublicRider { id: string; fullName: string }
export interface RiderWithContact extends PublicRider { phone: string; email: string }

export interface Place { label: string; lat: number; lng: number }

export interface PublicDriver { id: string; fullName: string }
export interface DriverWithContact extends PublicDriver { phone: string; email: string }

export interface Ride {
  id: string;
  origin: Place;
  destination: Place;
  departureAt: string;
  flexMinutes: number;
  departureWindow: { from: string; to: string };
  seatsTotal: number;
  seatsTaken: number;
  seatsAvailable: number;
  /** Decimal string, e.g. "300.00". Never parse into a number. */
  estimatedCost: string;
  status: RideStatus;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  driver: PublicDriver | DriverWithContact;
  isOwner: boolean;
}

export interface User {
  id: string; email: string; fullName: string; phone: string; createdAt: string;
}

export interface Tokens {
  accessToken: string; refreshToken: string; tokenType: 'Bearer'; expiresIn: number;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
  requestId: string;
}

/** The type guard that makes contact visibility explicit in the UI. */
export const hasContact = (d: PublicDriver | DriverWithContact): d is DriverWithContact =>
  'phone' in d;
```

Use `hasContact` rather than `driver.phone && ...`. The narrowing makes the rule
visible at the call site: contact details exist only once a booking is confirmed.

---

## Token handling

### Storage

`accessToken` in memory. `refreshToken` in whatever your platform makes hardest to
steal — an httpOnly cookie set by your own BFF if you have one, secure storage on
mobile, `localStorage` only if you have accepted the XSS exposure.

A refresh token in `localStorage` is readable by any script on the page. That is a
real risk, and it is the reason the backend rotates tokens and detects reuse: a
stolen token gets one use before the theft becomes visible and both parties are
logged out.

### Refresh rotation

**Every refresh invalidates the token you sent.** The rules:

- Persist the new `refreshToken` **before** any other work.
- Never fire two refreshes at once. Two concurrent calls with the same token look
  exactly like a stolen token being replayed, and the backend responds by revoking
  every session. This is the single most likely way to break the client.
- On `401 UNAUTHENTICATED` from `/auth/refresh`, clear local state and send the
  user to login. Do not retry.

A single-flight refresh, which is the part worth copying:

```ts
let inFlight: Promise<Tokens> | null = null;

async function refreshTokens(): Promise<Tokens> {
  // Every concurrent caller awaits the same promise, so exactly one request goes out.
  inFlight ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: store.refreshToken }),
      });
      if (!res.ok) throw new SessionExpired();

      const { tokens } = await res.json();
      store.set(tokens);          // persist before anything else observes it
      return tokens;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
```

### The fetch wrapper

```ts
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const call = (token?: string) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });

  let res = await call(store.accessToken);

  // Retry once, and only for an expired access token — a 401 for any other reason
  // will not be fixed by refreshing.
  if (res.status === 401) {
    const body = (await res.clone().json().catch(() => null)) as ApiError | null;
    if (body?.error.code === 'TOKEN_EXPIRED') {
      const tokens = await refreshTokens();
      res = await call(tokens.accessToken);
    }
  }

  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}
```

Distinguishing `TOKEN_EXPIRED` from `UNAUTHENTICATED` matters: refreshing on a
malformed token wastes a round trip, and refreshing on a revoked one gets a second
`401` that reads like a loop.

---

## Error handling

Branch on `error.code`. Suggested user-facing copy:

| Code | Say | Then |
|---|---|---|
| `VALIDATION_FAILED` | field errors from `details` | highlight the fields |
| `INVALID_CREDENTIALS` | "Email or password is incorrect" | never say which |
| `TOKEN_EXPIRED` | *nothing* | refresh and retry silently |
| `EMAIL_ALREADY_REGISTERED` | "That email already has an account" | offer login |
| `RIDE_NOT_FOUND` | "This ride is no longer available" | back to the list |
| `NO_SEATS_AVAILABLE` | "That seat just went" | refresh the ride |
| `ALREADY_BOOKED` | "You already have a seat on this ride" | link to the booking |
| `CANNOT_BOOK_OWN_RIDE` | "This is your ride" | show driver controls |
| `RIDE_COMPLETED_IMMUTABLE` | "This ride has finished" | make the view read-only |
| `RIDE_NOT_OPEN` | "This ride was cancelled" | back to the list |
| `RATE_LIMITED` | "Too many attempts, try shortly" | back off; read `RateLimit-Reset` |
| `INTERNAL_ERROR` | "Something went wrong" | show `requestId` — it finds the log line |

`details` on a validation error is an array of
`{ source, field, code, message }`, where `source` is `body`, `query` or `params`
and `field` is the dotted path. Mapping it onto form fields is usually a direct
lookup by `field`.

---

## Flows

### Sign up / sign in

```
register or login  →  { user, tokens }  →  store both  →  land on the ride list
```

Nothing else is needed; registration returns a usable session.

### Posting a ride (driver)

Send coordinates, not just labels — the label is for display, the coordinates are
what the matching query uses. Wire your place picker to whatever geocoder you like;
the API does not geocode.

`flexMinutes` is worth surfacing in the UI. It widens the window the ride is
matched against, so a driver who sets 30 appears in materially more searches than
one who leaves it at 0.

### Finding and booking (rider)

```
search (origin + destination + time window)
  → ride list, no contact details
  → book a seat
  → 201: contact details now visible on that ride
  → 409 NO_SEATS_AVAILABLE: someone else got it — re-fetch, don't retry blindly
```

Expect `NO_SEATS_AVAILABLE` as a normal outcome, not an error state. The backend
guarantees exactly one of two simultaneous bookings for the last seat succeeds, so
on a popular ride some users will legitimately lose. Re-fetch the ride and show the
current seat count rather than an error dialog.

Do not optimistically decrement `seatsAvailable` before the `201`. You cannot know
you won.

### Completing a ride (driver)

`POST /rides/:id/complete` is irreversible and the backend will not undo it.
Confirm before calling. Afterwards, render the whole ride read-only — every
mutating call will return `409`.

---

## UI rules that come from backend guarantees

**Contact details.** Show a driver's phone only when `hasContact(ride.driver)`. Do
not build a "request contact details" affordance — visibility follows automatically
from a confirmed booking, and is withdrawn the moment it is cancelled.

**Seat counts are advisory until you book.** `seatsAvailable` was true when the
response was generated. Treat it as a hint and let the booking call be the
authority.

**Cost is per confirmed rider and it moves.** `seatShare` is recalculated every time
someone books or cancels, so a rider's share goes **up** when another rider leaves.
Surface that — a silently increasing charge is the kind of thing people dispute.

**Cancelled bookings stay visible.** They are never deleted. A rider whose ride was
cancelled by the driver keeps a row with `CANCELLED_BY_DRIVER`, a reason and a
frozen `seatShare` with nothing owed. Show it as history rather than hiding it.

---

## Local development

```bash
cp .env.example .env
pnpm install
pnpm db:deploy && pnpm db:seed
pnpm dev                     # http://localhost:4000
```

Seeded accounts all share the password `Password123!`:
`asha@example.com`, `bhavik@example.com`, `chirag@example.com`, `divya@example.com`
— plus 40 open rides around Ahmedabad.

`GET /health` for liveness, `GET /ready` for readiness including the database.

CORS is `*` by default; set `CORS_ORIGINS` in `.env` to a comma-separated list
before exposing it anywhere real.

```bash
# a session end to end
curl -s localhost:4000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"asha@example.com","password":"Password123!"}'
```

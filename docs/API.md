# Ride Sharing & Matching — API Reference

Base URL `http://localhost:4000/api/v1` · JSON in, JSON out · all timestamps ISO 8601 UTC.

**Every example below is a real request and response captured from a running
server**, not written by hand. Ids and timestamps are from that session.

Companion documents: [FRONTEND.md](FRONTEND.md) for integration patterns (token
refresh, error handling, copy-paste types), [../ARCHITECTURE.md](../ARCHITECTURE.md)
for why the system is built this way.

---

## Contents

- [Conventions](#conventions) — auth, errors, rate limits, money
- [Auth](#auth) — register, login, refresh, logout
- [Profile](#profile) — `/me`
- [Rides](#rides) — post, read, update, cancel, complete
- [Search](#search) — the matching query
- [Bookings](#bookings) — book, list, manifest, cancel
- [Audit](#audit) — the trace behind every charge
- [Quick reference](#quick-reference) — every route on one screen

---

## Conventions

### Authentication

Everything except `/health`, `/ready` and the four `/auth/*` entry points needs:

```
Authorization: Bearer <accessToken>
```

Access tokens last **15 minutes**. On expiry the API returns `401` with
`error.code = "TOKEN_EXPIRED"` — refresh and retry rather than bouncing the user to
a login screen.

### Errors

One shape, every route:

```json
{
  "error": {
    "code": "RIDE_NOT_FOUND",
    "message": "Ride not found"
  },
  "requestId": "e26375db-ec50-4eff-aa42-b3a79dc2de0c"
}
```

A validation failure adds `details`:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": [
      {
        "source": "body",
        "field": "seatsTotal",
        "code": "too_small",
        "message": "A ride must offer at least 1 seat"
      }
    ]
  },
  "requestId": "c0d41fb9-dde1-47f6-a462-cd2f6b97f587"
}
```

`details[].source` is `body`, `query` or `params`; `field` is the dotted path, which
usually maps straight onto a form field.

**Branch on `error.code`, never on `error.message`.** Messages are written for humans
and will be reworded. `requestId` also comes back in the `x-request-id` header and
appears on every server log line for that request — quote it in a bug report.

| Status | Meaning |
|---|---|
| `400` | malformed request — see `details` |
| `401` | missing, invalid or expired credentials |
| `404` | not found **or not yours** — deliberately indistinguishable |
| `409` | conflicts with current state |
| `422` | well-formed but semantically impossible |
| `429` | rate limited |
| `500` | server fault; `requestId` identifies it in the logs |

There is no `403`. Asking for someone else's record returns `404`, so ids cannot be
probed for existence.

<details>
<summary>Every error code</summary>

`VALIDATION_FAILED` · `MALFORMED_REQUEST` · `UNAUTHENTICATED` · `INVALID_CREDENTIALS` ·
`TOKEN_EXPIRED` · `FORBIDDEN` · `NOT_RESOURCE_OWNER` · `NOT_FOUND` · `RIDE_NOT_FOUND` ·
`BOOKING_NOT_FOUND` · `USER_NOT_FOUND` · `CONFLICT` · `NO_SEATS_AVAILABLE` ·
`RIDE_NOT_OPEN` · `RIDE_COMPLETED_IMMUTABLE` · `ALREADY_BOOKED` ·
`EMAIL_ALREADY_REGISTERED` · `UNPROCESSABLE` · `DEPARTURE_IN_PAST` ·
`CANNOT_BOOK_OWN_RIDE` · `RATE_LIMITED` · `INTERNAL_ERROR` · `SERVICE_UNAVAILABLE`

</details>

### Money is always a string

`estimatedCost`, `seatShare`, `amountOwed` and `estimatedShare` are decimal strings
like `"160.00"`. They are `Decimal(10,2)` end to end in the database. **Do not parse
them into a JS number** — that reintroduces exactly the rounding error the backend
avoids. Keep them strings, or use a decimal library.

### Rate limits

300 requests/minute overall, 10/minute on `/auth/register`, `/auth/login` and
`/auth/refresh`. Keyed by user id once authenticated, by IP before that. Successful
auth requests do not count against the auth budget. Limits are reported in
`RateLimit-*` response headers.

### Pagination

`GET /me/rides` and `GET /me/bookings` are cursor-based: `?limit=20&cursor=<id>`.
`nextCursor` is `null` on the last page. Cursors are stable while rows are inserted
or removed, which offsets are not. Search is a ranked top-N and has no cursor.

---

## Auth

### `POST /auth/register`

```json
{
  "email": "fe-1-1789994295976@example.com",
  "password": "correct horse battery staple",
  "fullName": "FE 1",
  "phone": "+91 98111 00001"
}
```

Email is lowercased and must be unique. Password is **at least 12 characters** —
length only, no character-class rules. Phone accepts digits, spaces, parentheses,
hyphens and a leading `+`.

**`201 Created`**

```json
{
  "user": {
    "id": "c7167bb4-8108-4053-94f1-99942ea5943e",
    "email": "fe-1-1789994295976@example.com",
    "fullName": "FE 1",
    "phone": "+91 98111 00001",
    "createdAt": "2026-09-21T12:38:16.116Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImZlLTEtMTc4OTk5NDI5NTk3NkBleGFtcGxlLmNvbSIsInN1YiI6ImM3MTY3YmI0LTgxMDgtNDA1My05NGYxLTk5OTQyZWE1OTQzZSIsImp0aSI6ImY4M2ExZjE2LTkyYTYtNDNmNi1hOTkwLTBhODA5MzRjM2ZhMyIsImlzcyI6InJpZGUtbWF0Y2hpbmctYXBpIiwiYXVkIjoicmlkZS1tYXRjaGluZy1jbGllbnQiLCJpYXQiOjE3ODk5OTQyOTYsImV4cCI6MTc4OTk5NTE5Nn0.s0oVXTgaeE5gCvlViTZTYJgdSuGMNGAdU1csPYZbkMk",
    "refreshToken": "m638FvSd41ChN9dYyqsLFsUBuHqxyJKC1-6ZKb2DmhE",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

Registration returns a usable session; no separate login call is needed.

| Failure | Status | Code |
|---|---|---|
| email taken | `409` | `EMAIL_ALREADY_REGISTERED` |
| bad input | `400` | `VALIDATION_FAILED` |

### `POST /auth/login`

```json
{
  "email": "fe-1-1789994295976@example.com",
  "password": "correct horse battery staple"
}
```

**`200 OK`** — same body shape as register.

**`401`** for a wrong password *and* for an unknown email:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect"
  },
  "requestId": "0810e568-311e-49ba-b09e-6394777d0116"
}
```

The two cases take the same time as well as returning the same message, so login
cannot be used to discover which addresses have accounts.

### `POST /auth/refresh`

```json
{ "refreshToken": "..." }
```

**`200 OK`** — a fresh `user` + `tokens` pair.

> **The refresh token you sent is dead the moment this returns.** Store the new one
> before doing anything else, and never run two refreshes at once — see
> [FRONTEND.md](FRONTEND.md#refresh-rotation).

Replaying a spent token is treated as theft — two parties holding one secret — and
**every session for that user is revoked**:

```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Refresh token has already been used. All sessions have been ended."
  },
  "requestId": "3c1e1e94-48bd-48e9-bed7-151a7b75e47d"
}
```

`401 TOKEN_EXPIRED` instead means the refresh token itself aged out; log in again.

### `POST /auth/logout`

Body `{ "refreshToken": "..." }`. No access token required.

**`200 OK`** → `{
  "sessionsEnded": 0
}`

Idempotent: an unknown token returns `200` with `sessionsEnded: 0` rather than
revealing that it never existed.

### `POST /auth/logout-all`

Requires an access token, no body. Ends every session for the caller.

**`200 OK`** → `{
  "sessionsEnded": 1
}`

---

## Profile

### `GET /me`

**`200 OK`**

```json
{
  "user": {
    "id": "c7167bb4-8108-4053-94f1-99942ea5943e",
    "email": "fe-1-1789994295976@example.com",
    "fullName": "FE 1",
    "phone": "+91 98111 00001",
    "createdAt": "2026-09-21T12:38:16.116Z"
  }
}
```

Read from the database, not from the token — a token minted fifteen minutes ago
describes the user as they were then.

### `PATCH /me`

```json
{
  "fullName": "Asha M. Mehta"
}
```

`fullName` and `phone` only, at least one required. `email` and `password` are **not**
editable here: changing an address needs verification of the new one, and changing a
password needs the current one. Unknown fields are ignored rather than rejected.

**`200 OK`**

```json
{
  "user": {
    "id": "c7167bb4-8108-4053-94f1-99942ea5943e",
    "email": "fe-1-1789994295976@example.com",
    "fullName": "Asha M. Mehta",
    "phone": "+91 98111 00001",
    "createdAt": "2026-09-21T12:38:16.116Z"
  }
}
```

---

## Rides

### The ride object

```json
{
  "id": "8648a883-9eaa-408a-a8d2-ad9de5c59e3d",
  "origin": {
    "label": "Prahlad Nagar",
    "lat": 23.0103,
    "lng": 72.5074
  },
  "destination": {
    "label": "Vastrapur",
    "lat": 23.0364,
    "lng": 72.529
  },
  "departureAt": "2026-09-21T18:38:16.724Z",
  "flexMinutes": 30,
  "departureWindow": {
    "from": "2026-09-21T18:08:16.724Z",
    "to": "2026-09-21T19:08:16.724Z"
  },
  "seatsTotal": 3,
  "seatsTaken": 0,
  "seatsAvailable": 3,
  "estimatedCost": "300.00",
  "status": "OPEN",
  "createdAt": "2026-09-21T12:38:16.736Z",
  "completedAt": null,
  "cancelledAt": null,
  "driver": {
    "id": "c7167bb4-8108-4053-94f1-99942ea5943e",
    "fullName": "Asha M. Mehta",
    "phone": "+91 98111 00001",
    "email": "fe-1-1789994295976@example.com"
  },
  "isOwner": true
}
```

| Field | Notes |
|---|---|
| `estimatedCost` | decimal **string** — the whole ride, not per person |
| `departureWindow` | `departureAt ± flexMinutes`, computed by the database; this is what search matches against |
| `seatsAvailable` | `seatsTotal - seatsTaken`; advisory until you actually book |
| `status` | `OPEN` · `CANCELLED` · `COMPLETED` — `COMPLETED` is terminal |
| `isOwner` | saves comparing ids to decide whether to show driver controls |
| `driver` | **two shapes** — see below |

**`driver` is `{ id, fullName }`** for most viewers. It gains `phone` and `email`
only when the caller is the driver, or holds a **confirmed** booking on that ride.
Those columns are not fetched at all otherwise, so their absence is not something to
work around — render contact details only when they are present.

Same ride, viewed by someone with no booking:

```json
{
  "id": "c7167bb4-8108-4053-94f1-99942ea5943e",
  "fullName": "Asha M. Mehta"
}
```

…and by a rider who has booked it:

```json
{
  "id": "c7167bb4-8108-4053-94f1-99942ea5943e",
  "fullName": "Asha M. Mehta",
  "phone": "+91 98111 00001",
  "email": "fe-1-1789994295976@example.com"
}
```

### `POST /rides`

```json
{
  "originLabel": "Prahlad Nagar",
  "originLat": 23.0103,
  "originLng": 72.5074,
  "destLabel": "Vastrapur",
  "destLat": 23.0364,
  "destLng": 72.529,
  "departureAt": "2026-09-21T18:38:16.724Z",
  "flexMinutes": 30,
  "seatsTotal": 3,
  "estimatedCost": "300.00"
}
```

| Field | Rule |
|---|---|
| `originLabel` / `destLabel` | 2–200 chars; display only — matching uses the coordinates |
| `originLat` / `destLat` | −90…90 |
| `originLng` / `destLng` | −180…180 |
| `departureAt` | ISO 8601, must be **in the future** |
| `flexMinutes` | 0–720, default `0`; widens the window the ride is matched against |
| `seatsTotal` | integer 1–8 |
| `estimatedCost` | string or number, max 2 decimals, ≥ 0 |

Origin and destination must differ.

**`201 Created`** → `{ "ride": { ... } }`

Rejected examples — a past departure and a zero seat count both fail with
`400 VALIDATION_FAILED` before any business logic runs.

> `flexMinutes` is worth surfacing in the UI. A driver who sets 30 appears in
> materially more searches than one who leaves it at 0.

### `GET /rides/:id`

**`200 OK`** → `{ "ride": { ... } }`

Any authenticated user may read any ride; what differs is whether `driver` carries
contact details.

`400` if `:id` is not a UUID ·
`404 RIDE_NOT_FOUND` if it does not exist.

### `PATCH /rides/:id`

Driver only. Any subset of the create fields.

```json
{
  "seatsTotal": 4,
  "estimatedCost": "320.00"
}
```

**`200 OK`** → `{ "ride": { ... } }`

> **A partial update is genuinely partial** — fields you omit keep their current
> values. Send only what changed.

Latitude and longitude must be sent **as a pair**; accepting one without the other
would move the ride to a different meridian. An empty body is `400`.

| Failure | Status | Code |
|---|---|---|
| not your ride | `404` | `RIDE_NOT_FOUND` |
| ride completed | `409` | `RIDE_COMPLETED_IMMUTABLE` |
| ride cancelled | `409` | `RIDE_NOT_OPEN` |
| seats below those already booked | `422` | message names both numbers |

### `GET /me/rides`

Query: `limit` (1–100, default 20), `cursor`, `status`.

**`200 OK`**

```json
{ "rides": [ /* ride objects */ ], "nextCursor": null }
```

Rides where the caller is the **driver**, soonest departure first. Rides they have
booked come from `GET /me/bookings`.

### `POST /rides/:id/cancel`

Driver only. Optional `{ "reason": "Car trouble" }`.

**`200 OK`**

```json
{
  "ride": {
    "id": "2353ec01-c1c2-49a9-9d4f-26f08465820a",
    "origin": {
      "label": "Bodakdev",
      "lat": 23.0103,
      "lng": 72.5074
    },
    "destination": {
      "label": "Vastrapur",
      "lat": 23.0364,
      "lng": 72.529
    },
    "departureAt": "2026-09-21T18:38:16.724Z",
    "flexMinutes": 30,
    "departureWindow": {
      "from": "2026-09-21T18:08:16.724Z",
      "to": "2026-09-21T19:08:16.724Z"
    },
    "seatsTotal": 2,
    "seatsTaken": 0,
    "seatsAvailable": 2,
    "estimatedCost": "100.00",
    "status": "CANCELLED",
    "createdAt": "2026-09-21T12:38:17.156Z",
    "completedAt": null,
    "cancelledAt": "2026-09-21T12:38:17.191Z",
    "driver": {
      "id": "c7167bb4-8108-4053-94f1-99942ea5943e",
      "fullName": "Asha M. Mehta",
      "phone": "+91 98111 00001",
      "email": "fe-1-1789994295976@example.com"
    },
    "isOwner": true
  },
  "bookingsCancelled": 1
}
```

Cancels the ride **and every confirmed booking on it** in one transaction. Riders
keep a visible record — nothing is deleted.

### `POST /rides/:id/complete`

Driver only, no body. **Irreversible.**

**`200 OK`** → the ride with `status: "COMPLETED"` and a `completedAt`.

Afterwards every mutation returns `409 RIDE_COMPLETED_IMMUTABLE` — no bookings, no
cancellations, no edits, enforced by a database trigger as well as the API. Render
the whole ride read-only once you see this status.

```json
{
  "error": {
    "code": "RIDE_COMPLETED_IMMUTABLE",
    "message": "This ride is completed and can no longer be booked"
  },
  "requestId": "5c0748e1-e0c2-43da-bcda-a789f979e3b5"
}
```

---

## Search

### `GET /rides/search`

The matching query. Required: `originLat` `originLng` `destLat` `destLng`
`departAfter` `departBefore`. Optional: `radiusMeters` (100–50 000, default 5 000),
`seats` (1–8, default 1), `limit` (1–100, default 20).

```
GET /rides/search?originLat=23.0103&originLng=72.5074
                 &destLat=23.0364&destLng=72.5290
                 &radiusMeters=3000
                 &departAfter=2026-09-22T08:00:00Z
                 &departBefore=2026-09-22T12:00:00Z
```

**`200 OK`**

```json
{
  "rides": [
    {
      "id": "8648a883-9eaa-408a-a8d2-ad9de5c59e3d",
      "origin": {
        "label": "Prahlad Nagar",
        "lat": 23.0103,
        "lng": 72.5074
      },
      "destination": {
        "label": "Vastrapur",
        "lat": 23.0364,
        "lng": 72.529
      },
      "departureAt": "2026-09-21T18:38:16.724Z",
      "flexMinutes": 30,
      "seatsTotal": 4,
      "seatsAvailable": 4,
      "estimatedCost": "320.00",
      "estimatedShare": "320.00",
      "status": "OPEN",
      "driver": {
        "id": "c7167bb4-8108-4053-94f1-99942ea5943e",
        "fullName": "Asha M. Mehta"
      },
      "originMeters": 0,
      "destMeters": 0
    }
  ],
  "searchedAt": "2026-09-21T12:38:16.848Z"
}
```

**What matches.** A ride comes back only when its origin **and** its destination are
both within `radiusMeters`, **and** its departure window overlaps yours. Matching
only the origin, or only the time, is not a match. Requiring both endpoints also
makes search directional — the reverse commute has them swapped and fails both.

A ride's own `flexMinutes` widens its window, so a flexible ride can match a request
its exact departure time would miss.

**Show `estimatedShare`, not `estimatedCost`.** It is what this rider would pay if
they joined, computed for the current confirmed riders plus them, using the same
split logic the booking will apply. Still an estimate — anyone booking or cancelling
first will move it.

**Never any contact details.** A search result is not a match, so `driver` is always
`{ id, fullName }`.

Also excluded: your own rides, full rides, rides with fewer than `seats` free,
cancelled and completed rides, and anything already departed.

The time window may span at most 24 hours:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": [
      {
        "source": "query",
        "field": "departBefore",
        "code": "custom",
        "message": "The time window may not exceed 24 hours"
      }
    ]
  },
  "requestId": "01c45eb4-0d9f-4418-8c48-1738664440d3"
}
```

---

## Bookings

### The booking object

```json
{
  "id": "54e85a92-129a-47c4-a34c-d3a9abadca10",
  "rideId": "8648a883-9eaa-408a-a8d2-ad9de5c59e3d",
  "riderId": "6719d43d-b913-4e69-9e7c-46f9db46c3d9",
  "status": "CONFIRMED",
  "seatShare": "320.00",
  "amountOwed": "320.00",
  "createdAt": "2026-09-21T12:38:16.864Z",
  "cancelledAt": null,
  "cancellationReason": null
}
```

`status` is `CONFIRMED` · `CANCELLED_BY_RIDER` · `CANCELLED_BY_DRIVER`. There is no
pending state — a booking either claimed a seat or does not exist.

**`seatShare` moves.** It is this rider's share of `estimatedCost` as of the last
recalculation, which happens every time the confirmed rider set changes. A rider's
share **goes up** when somebody else cancels. Surface that; a silently increasing
charge is what people dispute.

**`seatShare` vs `amountOwed`.** A cancelled booking keeps its `seatShare` as the
record of what the rider was told, while `amountOwed` becomes `"0.00"`. Collapsing
the two would make history unreadable — you could no longer tell "paid 150" from
"was quoted 150, then the driver cancelled".

### `POST /rides/:id/bookings`

No body; the caller is the rider.

**`201 Created`** → `{ "booking": { ... } }`

> **Exactly one of two simultaneous requests for the last seat succeeds.** The other
> gets `409 NO_SEATS_AVAILABLE`. Treat that as a normal outcome on a popular ride,
> not an error state: re-fetch the ride and show the current seat count. **Do not
> optimistically decrement `seatsAvailable`** before the `201` — you cannot know you
> won.

A confirmed booking immediately makes the driver's contact details visible to the
rider, and the rider's to the driver.

| Failure | Status | Code |
|---|---|---|
| full, or already departed | `409` | `NO_SEATS_AVAILABLE` |
| you already hold a seat | `409` | `ALREADY_BOOKED` |
| ride cancelled | `409` | `RIDE_NOT_OPEN` |
| ride completed | `409` | `RIDE_COMPLETED_IMMUTABLE` |
| you are the driver | `422` | `CANNOT_BOOK_OWN_RIDE` |

```json
{
  "error": {
    "code": "CANNOT_BOOK_OWN_RIDE",
    "message": "You cannot book a seat on a ride you are driving"
  },
  "requestId": "ffaf7cbb-9841-43ab-b814-66cda60249a0"
}
```

### `GET /me/bookings`

Query: `limit`, `cursor`, `status`.

**`200 OK`** — each booking carries its full `ride`:

```json
{
  "bookings": [
    {
      "id": "54e85a92-129a-47c4-a34c-d3a9abadca10",
      "rideId": "8648a883-9eaa-408a-a8d2-ad9de5c59e3d",
      "riderId": "6719d43d-b913-4e69-9e7c-46f9db46c3d9",
      "status": "CONFIRMED",
      "seatShare": "160.00",
      "amountOwed": "160.00",
      "createdAt": "2026-09-21T12:38:16.864Z",
      "cancelledAt": null,
      "cancellationReason": null,
      "ride": {
        "id": "8648a883-9eaa-408a-a8d2-ad9de5c59e3d",
        "origin": {
          "label": "Prahlad Nagar",
          "lat": 23.0103,
          "lng": 72.5074
        },
        "destination": {
          "label": "Vastrapur",
          "lat": 23.0364,
          "lng": 72.529
        },
        "departureAt": "2026-09-21T18:38:16.724Z",
        "flexMinutes": 30,
        "departureWindow": {
          "from": "2026-09-21T18:08:16.724Z",
          "to": "2026-09-21T19:08:16.724Z"
        },
        "seatsTotal": 4,
        "seatsTaken": 2,
        "seatsAvailable": 2,
        "estimatedCost": "320.00",
        "status": "OPEN",
        "createdAt": "2026-09-21T12:38:16.736Z",
        "completedAt": null,
        "cancelledAt": null,
        "driver": {
          "id": "c7167bb4-8108-4053-94f1-99942ea5943e",
          "fullName": "Asha M. Mehta",
          "phone": "+91 98111 00001",
          "email": "fe-1-1789994295976@example.com"
        },
        "isOwner": false
      }
    }
  ],
  "nextCursor": null
}
```

Cancelled bookings stay in this list. A ride cancelled by its driver looks like this
— note the frozen `seatShare`, the zero `amountOwed`, the reason, and that the
driver's contact details have been withdrawn:

```json
{
  "id": "1cce30ba-c33c-4c77-b8b1-172c2113f802",
  "rideId": "2353ec01-c1c2-49a9-9d4f-26f08465820a",
  "riderId": "6719d43d-b913-4e69-9e7c-46f9db46c3d9",
  "status": "CANCELLED_BY_DRIVER",
  "seatShare": "100.00",
  "amountOwed": "0.00",
  "createdAt": "2026-09-21T12:38:17.170Z",
  "cancelledAt": "2026-09-21T12:38:17.186Z",
  "cancellationReason": "Car trouble",
  "ride": {
    "id": "2353ec01-c1c2-49a9-9d4f-26f08465820a",
    "origin": {
      "label": "Bodakdev",
      "lat": 23.0103,
      "lng": 72.5074
    },
    "destination": {
      "label": "Vastrapur",
      "lat": 23.0364,
      "lng": 72.529
    },
    "departureAt": "2026-09-21T18:38:16.724Z",
    "flexMinutes": 30,
    "departureWindow": {
      "from": "2026-09-21T18:08:16.724Z",
      "to": "2026-09-21T19:08:16.724Z"
    },
    "seatsTotal": 2,
    "seatsTaken": 0,
    "seatsAvailable": 2,
    "estimatedCost": "100.00",
    "status": "CANCELLED",
    "createdAt": "2026-09-21T12:38:17.156Z",
    "completedAt": null,
    "cancelledAt": "2026-09-21T12:38:17.191Z",
    "driver": {
      "id": "c7167bb4-8108-4053-94f1-99942ea5943e",
      "fullName": "Asha M. Mehta"
    },
    "isOwner": false
  }
}
```

### `GET /rides/:id/bookings`

Driver of that ride only — anyone else, **including a rider on the ride**, gets
`404`.

**`200 OK`**

```json
{
  "bookings": [
    {
      "id": "54e85a92-129a-47c4-a34c-d3a9abadca10",
      "rideId": "8648a883-9eaa-408a-a8d2-ad9de5c59e3d",
      "riderId": "6719d43d-b913-4e69-9e7c-46f9db46c3d9",
      "status": "CONFIRMED",
      "seatShare": "160.00",
      "amountOwed": "160.00",
      "createdAt": "2026-09-21T12:38:16.864Z",
      "cancelledAt": null,
      "cancellationReason": null,
      "rider": {
        "id": "6719d43d-b913-4e69-9e7c-46f9db46c3d9",
        "fullName": "FE 2",
        "phone": "+91 98111 00002",
        "email": "fe-2-1789994295976@example.com"
      }
    },
    {
      "id": "fd454da0-8fd9-45d6-9228-5c32e9c62a9e",
      "rideId": "8648a883-9eaa-408a-a8d2-ad9de5c59e3d",
      "riderId": "0eec0f25-72f0-4171-9506-1bcafa890c7c",
      "status": "CONFIRMED",
      "seatShare": "160.00",
      "amountOwed": "160.00",
      "createdAt": "2026-09-21T12:38:16.915Z",
      "cancelledAt": null,
      "cancellationReason": null,
      "rider": {
        "id": "0eec0f25-72f0-4171-9506-1bcafa890c7c",
        "fullName": "FE 3",
        "phone": "+91 98111 00003",
        "email": "fe-3-1789994295976@example.com"
      }
    }
  ]
}
```

Confirmed riders carry `phone` and `email`; cancelled riders do not.

### `POST /bookings/:id/cancel`

Optional `{ "reason": "Plans changed" }`. Callable by **the rider who holds the
booking, or the driver of that ride** — the API works out which you are and records
it. Anyone else gets `404`.

**`200 OK`**

```json
{
  "booking": {
    "id": "54e85a92-129a-47c4-a34c-d3a9abadca10",
    "rideId": "8648a883-9eaa-408a-a8d2-ad9de5c59e3d",
    "riderId": "6719d43d-b913-4e69-9e7c-46f9db46c3d9",
    "status": "CANCELLED_BY_RIDER",
    "seatShare": "160.00",
    "amountOwed": "0.00",
    "createdAt": "2026-09-21T12:38:16.864Z",
    "cancelledAt": "2026-09-21T12:38:16.989Z",
    "cancellationReason": "Plans changed"
  },
  "seatsAvailable": 3
}
```

The seat is bookable again the instant this returns; the release, the status change
and the recalculation are one transaction. Every remaining rider's `seatShare` goes
up, so re-fetch rather than assuming the numbers held.

A rider may book the same ride again after cancelling — the uniqueness rule applies
only to confirmed bookings.

| Failure | Status | Code |
|---|---|---|
| already cancelled | `409` | `CONFLICT` |
| ride completed | `409` | `RIDE_COMPLETED_IMMUTABLE` |
| not yours to cancel | `404` | `BOOKING_NOT_FOUND` |

---

## Audit

### `GET /rides/:id/audit`

Participants only — the driver, or anyone who has ever booked the ride, **including
riders whose booking was cancelled**, since they are the most likely to be disputing
something. Anyone else gets `404`. Query: `limit` (1–100, default 50).

**`200 OK`**

```json
[
  {
    "id": "1",
    "eventType": "RIDE_POSTED",
    "rideId": "8648a883-9eaa-408a-a8d2-ad9de5c59e3d",
    "bookingId": null,
    "actorId": "c7167bb4-8108-4053-94f1-99942ea5943e",
    "requestId": "797dca47-976a-4a2d-9dd3-2776c3da50b9",
    "payload": {
      "origin": {
        "lat": 23.0103,
        "lng": 72.5074,
        "label": "Prahlad Nagar"
      },
      "seatsTotal": 3,
      "departureAt": "2026-09-21T18:38:16.724Z",
      "destination": {
        "lat": 23.0364,
        "lng": 72.529,
        "label": "Vastrapur"
      },
      "flexMinutes": 30,
      "estimatedCost": "300.00"
    },
    "createdAt": "2026-09-21T12:38:16.745Z"
  },
  {
    "id": "2",
    "eventType": "RIDE_UPDATED",
    "rideId": "8648a883-9eaa-408a-a8d2-ad9de5c59e3d",
    "bookingId": null,
    "actorId": "c7167bb4-8108-4053-94f1-99942ea5943e",
    "requestId": "45b1e97f-c969-4a3c-970a-eb9dee92d44d",
    "payload": {
      "changes": {
        "seatsTotal": {
          "to": 4,
          "from": 3
        },
        "estimatedCost": {
          "to": "320.00",
          "from": "300.00"
        }
      }
    },
    "createdAt": "2026-09-21T12:38:16.807Z"
  },
  {
    "id": "3",
    "eventType": "COST_SPLIT_RECALCULATED",
    "rideId": "8648a883-9eaa-408a-a8d2-ad9de5c59e3d",
    "bookingId": null,
    "actorId": "6719d43d-b913-4e69-9e7c-46f9db46c3d9",
    "requestId": "6f4407b4-e0b5-43d4-9ebe-7dea7ebb3c36",
    "payload": {
      "riders": [
        {
          "share": "320.00",
          "riderId": "6719d43d-b913-4e69-9e7c-46f9db46c3d9",
          "bookingId": "54e85a92-129a-47c4-a34c-d3a9abadca10",
          "previousShare": "0.00"
        }
      ],
      "payerCount": 1,
      "estimatedCost": "320.00",
      "driverSharesCost": false
    },
    "createdAt": "2026-09-21T12:38:16.875Z"
  }
]
```

The ordered record of everything that happened to a ride. `eventType` is one of
`RIDE_POSTED`, `RIDE_UPDATED`, `RIDE_CANCELLED`, `RIDE_COMPLETED`,
`BOOKING_CREATED`, `BOOKING_CANCELLED`, `COST_SPLIT_RECALCULATED`.

`id` is a **string** — it is a 64-bit counter and JSON numbers cannot hold one safely.

Every event is written in the same transaction as the change it describes, and the
table is append-only at the database level, so the trail can never describe
something that did not happen.

**`COST_SPLIT_RECALCULATED` answers "why am I being charged this?"** Each one carries
the full rider table at that instant with both the previous and the new share, so a
rider's history reads straight off the trail:

```
COST_SPLIT_RECALCULATED   my share   0.00 → 300.00    (I booked, sole rider)
COST_SPLIT_RECALCULATED   my share 300.00 → 150.00    (a second rider joined)
COST_SPLIT_RECALCULATED   my share 150.00 → 100.00    (a third joined)
COST_SPLIT_RECALCULATED   my share 100.00 → 150.00    (the third cancelled)
RIDE_COMPLETED            final: ["150.00", "150.00"]
```

---

## Quick reference

| Method | Path | Auth | Returns |
|---|---|---|---|
| `GET` | `/health` | — | liveness |
| `GET` | `/ready` | — | readiness incl. database |
| `POST` | `/api/v1/auth/register` | — | `{ user, tokens }` |
| `POST` | `/api/v1/auth/login` | — | `{ user, tokens }` |
| `POST` | `/api/v1/auth/refresh` | refresh token | `{ user, tokens }` |
| `POST` | `/api/v1/auth/logout` | refresh token | `{ sessionsEnded }` |
| `POST` | `/api/v1/auth/logout-all` | access token | `{ sessionsEnded }` |
| `GET` | `/api/v1/me` | access token | `{ user }` |
| `PATCH` | `/api/v1/me` | access token | `{ user }` |
| `GET` | `/api/v1/me/rides` | access token | `{ rides, nextCursor }` |
| `GET` | `/api/v1/me/bookings` | access token | `{ bookings, nextCursor }` |
| `POST` | `/api/v1/rides` | access token | `{ ride }` |
| `GET` | `/api/v1/rides/search` | access token | `{ rides, searchedAt }` |
| `GET` | `/api/v1/rides/:id` | access token | `{ ride }` |
| `PATCH` | `/api/v1/rides/:id` | driver | `{ ride }` |
| `POST` | `/api/v1/rides/:id/cancel` | driver | `{ ride, bookingsCancelled }` |
| `POST` | `/api/v1/rides/:id/complete` | driver | `{ ride }` |
| `POST` | `/api/v1/rides/:id/bookings` | access token | `{ booking }` |
| `GET` | `/api/v1/rides/:id/bookings` | driver | `{ bookings }` |
| `GET` | `/api/v1/rides/:id/audit` | participants | `{ events }` |
| `POST` | `/api/v1/bookings/:id/cancel` | rider or driver | `{ booking, seatsAvailable }` |

---

## Trying it locally

```bash
cp .env.example .env
pnpm install
pnpm db:deploy && pnpm db:seed
pnpm dev                       # http://localhost:4000
```

Seeded accounts share the password `Password123!`: `asha@example.com`,
`bhavik@example.com`, `chirag@example.com`, `divya@example.com`, plus 40 open rides
around Ahmedabad.

```bash
TOKEN=$(curl -s localhost:4000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"asha@example.com","password":"Password123!"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["tokens"]["accessToken"])')

curl -s localhost:4000/api/v1/me -H "Authorization: Bearer $TOKEN"
```

CORS is `*` by default; set `CORS_ORIGINS` in `.env` before exposing this anywhere real.

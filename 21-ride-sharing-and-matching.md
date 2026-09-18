# POC: Ride Sharing and Matching

**Track:** Mobility · **Status:** Required · **Path:** React to Full Stack — 101 (2-week solo POC)
**Stack:** Express or Next.js (engineer's choice) · PostgreSQL · Prisma

## 1. Background

Riders and drivers currently coordinate through group chats. Seats get promised twice because
nobody has a single source of truth for who's actually confirmed, and there's no way to search
for who else is travelling a similar route at a similar time without scrolling through messages.

You're building the system that fixes this: drivers post a ride with its route and available
seats, riders search for something that matches where and when they're going, and booking a
seat is a real, race-safe operation instead of a promise in a chat thread.

This POC's centre of gravity is **matching that actually runs in the database, and a seat
count that never oversells** — a query that filters by loading everything into JavaScript and a
seat count that can go negative are both real failures here, even if the happy path demos
perfectly.

## 2. Actors

| Role | Can do |
|---|---|
| **Driver** | Post rides, view and manage bookings on their own rides, cancel their own ride |
| **Rider** | Search for rides, book a seat, view own bookings, cancel their own booking |

## 3. Functional requirements

### 3.1 Posting a ride
- A driver posts a ride with an origin, destination, departure time, and number of available
  seats.
- A ride cannot be booked beyond its seat count.

### 3.2 Searching and matching
- Riders search for rides matching their intended route and a time window.
- **Matching considers the proximity of both origin and destination together with overlap of
  the time window** — this is the core hard case of this POC. A rider going roughly the same
  direction at roughly the same time should be surfaced; a ride that matches only the origin or
  only the time should not.
- This is a real query against ride data, not a client-side filter over "all rides."

### 3.3 Booking a seat
- A rider books a seat on a matched ride.
- **Two riders booking the last available seat at the same moment must not both succeed.** How
  you guarantee that is entirely your design decision, and you should be ready to explain why
  you didn't pick one of the other reasonable approaches.

### 3.4 Cancellation
- Either the rider or the driver can cancel a booking; the seat returns to availability
  immediately — no stale "still booked" window.
- A driver cancelling the whole ride cancels all of its bookings; decide what a rider sees when
  that happens and document it.

### 3.5 Cost splitting
- An estimated cost for the ride is split across confirmed riders.
- The split is recalculated whenever a rider cancels, so the remaining riders' shares update
  correctly.

### 3.6 Locking completed rides
- Once a ride is marked completed, it cannot be modified — no new bookings, no cancellations,
  no changes to its route or seat count.

### 3.7 Contact visibility
- Contact details between rider and driver become visible only once a match (a confirmed
  booking) exists — not during search, and not for a pending or cancelled booking.

## 4. Data to think through

You choose the exact schema. At minimum, your model needs to represent: drivers, riders, rides
with their route, time, and seat count, bookings tied to a rider and a ride with their own
status, and enough structure to recompute the cost split whenever the set of confirmed riders
changes.

The question worth sitting with before you write any code: how do you represent "origin" and
"destination" such that a proximity-plus-time-overlap match can be expressed as a real,
indexable database query rather than a full scan filtered in application code? There's more
than one legitimate way to do this — pick one, and be ready to explain what it costs as the
number of open rides grows.

## 5. How it's exposed

Design the API surface — routes, methods, request/response shapes — however fits the workflow
above. There's no prescribed structure here; the requirements in §3 are the spec, not a
particular set of endpoints.

## 6. Things this POC will specifically be checked for

- Bad input — a ride with a departure time in the past, a seat count of zero, a booking request
  for a ride that doesn't exist — should be rejected before it reaches your business logic.
- There's no anonymous path through this system; every ride, booking, and cancellation is tied
  to a real, authenticated user.
- A rider can cancel only their own booking and a driver only their own ride — including if
  either tries to reach someone else's record directly by its ID. Prove this with a test, not a
  UI check.
- **The last-seat guarantee (§3.3) is the single most important, sharpest test in this POC.**
  Have a test that fires two concurrent booking requests for the last seat and asserts exactly
  one succeeds — not two sequential requests that happen to look fine.
- The matching search needs to support proximity-plus-time filtering as a real query; show what
  it costs with a large number of open rides, and what, if anything, is indexed for it.
- Every ride posting, booking, cancellation, and cost recalculation should leave a structured
  trace — useful evidence if a rider disputes what they were actually charged.
- The whole thing should come up with `docker compose up` and no manual setup beyond a
  documented `.env`.

## 7. Walkthrough questions to expect

NOTE: These are indicative questions only. Expect to be asked further questions in a similar
spirit during the walkthrough.

1. Show me the matching query. How does it filter by proximity of both origin and destination?
2. Contact details appear only after a confirmed match. Excluded at the query or filtered after?
3. A completed ride cannot be modified. Enforced where?

## 8. If you finish early (optional)

Don't add new features — deepen what's here:
- Load-test the matching query at a simulated 10,000 open rides and show the query plan and any
  indexes you added in response.
- Add a partial-route match (e.g. a rider joining partway along the route, not just at the
  origin) and show it fits the same matching primitive.
- Simulate two application instances booking against the same ride concurrently and demonstrate
  the last-seat guarantee still holds.

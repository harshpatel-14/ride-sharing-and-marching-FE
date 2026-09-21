/**
 * Stub of the Express API, implementing the contract in docs/API.md.
 *
 * This exists so the E2E suite can run the real browser against the real
 * frontend without a database. It is NOT a second implementation of the
 * business rules — it is a fixture. Where it enforces something (the last
 * seat, ownership, immutability) it does so because the specs assert the
 * frontend's behaviour in response, and a stub that always said yes would
 * make those assertions meaningless.
 *
 * Swap it for the real API by pointing API_URL elsewhere; the specs do not
 * know the difference.
 */
import { createServer } from 'node:http'

const PORT = Number(process.env.STUB_API_PORT ?? 4010)

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (sub, ttlSeconds) => `h.${b64({ sub, exp: Math.trunc(Date.now() / 1000) + ttlSeconds })}.s`
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString()
const win = (at, flex) => ({
  from: new Date(+new Date(at) - flex * 60_000).toISOString(),
  to: new Date(+new Date(at) + flex * 60_000).toISOString(),
})

const DRIVER = '11111111-1111-4111-8111-111111111111'
const RIDER_A = '22222222-2222-4222-8222-222222222222'
const RIDER_B = '33333333-3333-4333-8333-333333333333'

let users, rides, bookings, refreshTokens, seq, bookingSeq

function reset() {
  users = {
    [DRIVER]: { id: DRIVER, email: 'asha@example.com', fullName: 'Asha Mehta', phone: '+91 98111 00001', createdAt: iso(0) },
    [RIDER_A]: { id: RIDER_A, email: 'bhavik@example.com', fullName: 'Bhavik Patel', phone: '+91 98111 00002', createdAt: iso(0) },
    [RIDER_B]: { id: RIDER_B, email: 'chirag@example.com', fullName: 'Chirag Shah', phone: '+91 98111 00003', createdAt: iso(0) },
  }
  rides = {
    // Three seats: the ordinary booking path.
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': mkRide('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Prahlad Nagar', 23.0103, 72.5074, 'Vastrapur', 23.0364, 72.529, 3, '300.00'),
    // Exactly one seat: the race.
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb': mkRide('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Bodakdev', 23.0405, 72.5065, 'Maninagar', 22.9962, 72.6009, 1, '200.00'),
    // Already completed: the immutability lock.
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc': {
      ...mkRide('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Satellite', 23.0301, 72.5100, 'Naroda', 23.0700, 72.6600, 2, '240.00'),
      status: 'COMPLETED', completedAt: iso(-3_600_000), departureAt: iso(-6 * 3_600_000),
    },
  }
  bookings = []
  refreshTokens = new Map()
  seq = 0
  bookingSeq = 0
}

function mkRide(id, oLabel, oLat, oLng, dLabel, dLat, dLng, seats, cost) {
  return {
    id,
    origin: { label: oLabel, lat: oLat, lng: oLng },
    destination: { label: dLabel, lat: dLat, lng: dLng },
    departureAt: iso(6 * 3_600_000),
    flexMinutes: 30,
    seatsTotal: seats,
    estimatedCost: cost,
    status: 'OPEN',
    createdAt: iso(-3_600_000),
    completedAt: null,
    cancelledAt: null,
    driverId: DRIVER,
  }
}

reset()

const confirmed = (rideId) => bookings.filter((b) => b.rideId === rideId && b.status === 'CONFIRMED')
const seatsTaken = (rideId) => confirmed(rideId).length

/** Integer-paise split with a deterministic remainder, mirroring the real one. */
function recalculate(rideId) {
  const ride = rides[rideId]
  const riders = confirmed(rideId)
  if (riders.length === 0) return
  const totalPaise = Math.round(Number.parseFloat(ride.estimatedCost) * 100)
  const base = Math.floor(totalPaise / riders.length)
  let remainder = totalPaise - base * riders.length
  for (const booking of riders) {
    const paise = base + (remainder-- > 0 ? 1 : 0)
    booking.seatShare = (paise / 100).toFixed(2)
    booking.amountOwed = booking.seatShare
  }
}

function shapeRide(ride, viewerId) {
  const isOwner = ride.driverId === viewerId
  const hasBooking = bookings.some((b) => b.rideId === ride.id && b.riderId === viewerId && b.status === 'CONFIRMED')
  const d = users[ride.driverId]
  const taken = seatsTaken(ride.id)
  return {
    id: ride.id,
    origin: ride.origin,
    destination: ride.destination,
    departureAt: ride.departureAt,
    flexMinutes: ride.flexMinutes,
    departureWindow: win(ride.departureAt, ride.flexMinutes),
    seatsTotal: ride.seatsTotal,
    seatsTaken: taken,
    seatsAvailable: ride.seatsTotal - taken,
    estimatedCost: ride.estimatedCost,
    status: ride.status,
    createdAt: ride.createdAt,
    completedAt: ride.completedAt,
    cancelledAt: ride.cancelledAt,
    // Contact details only for the driver or a confirmed rider. (spec §3.7)
    driver: isOwner || hasBooking
      ? { id: d.id, fullName: d.fullName, phone: d.phone, email: d.email }
      : { id: d.id, fullName: d.fullName },
    isOwner,
  }
}

const metres = (lat1, lng1, lat2, lng2) => {
  const rad = (x) => (x * Math.PI) / 180
  const h =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h))
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://stub')
  const path = url.pathname.replace(/^\/api\/v1/, '')
  const send = (status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }
  const fail = (status, code, message) =>
    send(status, { error: { code, message }, requestId: `stub-${Math.random().toString(36).slice(2, 8)}` })

  let body = {}
  if (req.method !== 'GET') {
    const raw = await new Promise((resolve) => {
      let data = ''
      req.on('data', (c) => (data += c))
      req.on('end', () => resolve(data))
    })
    body = raw ? JSON.parse(raw) : {}
  }

  // Test-only control plane, so each spec starts from a known world.
  if (path === '/__test__/reset') {
    reset()
    return send(200, { ok: true })
  }

  const issue = (userId) => {
    const token = `rt-${++seq}`
    refreshTokens.set(token, { userId, used: false })
    return { accessToken: jwt(userId, 900), refreshToken: token, tokenType: 'Bearer', expiresIn: 900 }
  }

  if (path === '/auth/login') {
    const user = Object.values(users).find((u) => u.email === body.email)
    if (!user || body.password !== 'Password123!') {
      return fail(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect')
    }
    return send(200, { user, tokens: issue(user.id) })
  }

  if (path === '/auth/register') {
    if (Object.values(users).some((u) => u.email === body.email)) {
      return fail(409, 'EMAIL_ALREADY_REGISTERED', 'That email already has an account')
    }
    if ((body.password ?? '').length < 12) {
      return send(400, {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed',
          details: [{ source: 'body', field: 'password', code: 'too_small', message: 'Password must be at least 12 characters' }],
        },
        requestId: 'stub-reg',
      })
    }
    const id = `99999999-9999-4999-8999-${String(++seq).padStart(12, '0')}`
    users[id] = { id, email: body.email, fullName: body.fullName, phone: body.phone, createdAt: new Date().toISOString() }
    return send(201, { user: users[id], tokens: issue(id) })
  }

  if (path === '/auth/refresh') {
    const record = refreshTokens.get(body.refreshToken)
    if (!record) return fail(401, 'UNAUTHENTICATED', 'Unknown refresh token')
    if (record.used) return fail(401, 'UNAUTHENTICATED', 'Refresh token has already been used. All sessions have been ended.')
    record.used = true
    return send(200, { user: users[record.userId], tokens: issue(record.userId) })
  }

  if (path === '/auth/logout') return send(200, { sessionsEnded: 1 })

  /* ── authenticated ─────────────────────────────────────────────────── */
  const header = req.headers.authorization ?? ''
  if (!header.startsWith('Bearer ')) return fail(401, 'UNAUTHENTICATED', 'Missing token')
  let claims
  try {
    claims = JSON.parse(Buffer.from(header.slice(7).split('.')[1], 'base64url').toString())
  } catch {
    return fail(401, 'UNAUTHENTICATED', 'Malformed token')
  }
  if (claims.exp * 1000 < Date.now()) return fail(401, 'TOKEN_EXPIRED', 'Access token has expired')
  const me = claims.sub

  if (path === '/me') return send(200, { user: users[me] })

  if (path === '/me/rides') {
    return send(200, {
      rides: Object.values(rides).filter((r) => r.driverId === me).map((r) => shapeRide(r, me)),
      nextCursor: null,
    })
  }

  if (path === '/me/bookings') {
    return send(200, {
      bookings: bookings
        .filter((b) => b.riderId === me)
        .map((b) => ({ ...b, ride: shapeRide(rides[b.rideId], me) })),
      nextCursor: null,
    })
  }

  if (path === '/rides/search') {
    const q = Object.fromEntries(url.searchParams)
    const radius = Number(q.radiusMeters ?? 5000)
    const after = new Date(q.departAfter)
    const before = new Date(q.departBefore)

    const matched = Object.values(rides).filter((r) => {
      if (r.status !== 'OPEN' || r.driverId === me) return false
      if (r.seatsTotal - seatsTaken(r.id) < Number(q.seats ?? 1)) return false
      // BOTH endpoints within radius AND the windows overlap. (spec §3.2)
      const om = metres(Number(q.originLat), Number(q.originLng), r.origin.lat, r.origin.lng)
      const dm = metres(Number(q.destLat), Number(q.destLng), r.destination.lat, r.destination.lng)
      if (om > radius || dm > radius) return false
      const w = win(r.departureAt, r.flexMinutes)
      return new Date(w.to) >= after && new Date(w.from) <= before
    })

    return send(200, {
      rides: matched.map((r) => {
        const payers = seatsTaken(r.id) + 1
        const share = (Math.round(Number.parseFloat(r.estimatedCost) * 100) / payers / 100).toFixed(2)
        return {
          id: r.id,
          origin: r.origin,
          destination: r.destination,
          departureAt: r.departureAt,
          flexMinutes: r.flexMinutes,
          seatsTotal: r.seatsTotal,
          seatsAvailable: r.seatsTotal - seatsTaken(r.id),
          estimatedCost: r.estimatedCost,
          estimatedShare: share,
          status: r.status,
          // Never contact details: a search result is not a match.
          driver: { id: users[r.driverId].id, fullName: users[r.driverId].fullName },
          originMeters: Math.round(metres(Number(q.originLat), Number(q.originLng), r.origin.lat, r.origin.lng)),
          destMeters: Math.round(metres(Number(q.destLat), Number(q.destLng), r.destination.lat, r.destination.lng)),
        }
      }),
      searchedAt: new Date().toISOString(),
    })
  }

  if (path === '/rides' && req.method === 'POST') {
    if (new Date(body.departureAt) <= new Date()) {
      return fail(400, 'VALIDATION_FAILED', 'Departure must be in the future')
    }
    const id = `dddddddd-dddd-4ddd-8ddd-${String(++seq).padStart(12, '0')}`
    rides[id] = {
      id,
      origin: { label: body.originLabel, lat: body.originLat, lng: body.originLng },
      destination: { label: body.destLabel, lat: body.destLat, lng: body.destLng },
      departureAt: body.departureAt,
      flexMinutes: body.flexMinutes ?? 0,
      seatsTotal: body.seatsTotal,
      estimatedCost: String(body.estimatedCost),
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      completedAt: null,
      cancelledAt: null,
      driverId: me,
    }
    return send(201, { ride: shapeRide(rides[id], me) })
  }

  let match = path.match(/^\/rides\/([^/]+)\/bookings$/)
  if (match) {
    const ride = rides[match[1]]
    if (!ride) return fail(404, 'RIDE_NOT_FOUND', 'Ride not found')

    if (req.method === 'GET') {
      // Driver only — anyone else, including a rider on the ride, gets 404.
      if (ride.driverId !== me) return fail(404, 'RIDE_NOT_FOUND', 'Ride not found')
      return send(200, {
        bookings: bookings
          .filter((b) => b.rideId === ride.id)
          .map((b) => ({
            ...b,
            rider: b.status === 'CONFIRMED'
              ? { id: b.riderId, fullName: users[b.riderId].fullName, phone: users[b.riderId].phone, email: users[b.riderId].email }
              : { id: b.riderId, fullName: users[b.riderId].fullName },
          })),
      })
    }

    if (ride.driverId === me) return fail(422, 'CANNOT_BOOK_OWN_RIDE', 'You cannot book a seat on a ride you are driving')
    if (ride.status === 'COMPLETED') return fail(409, 'RIDE_COMPLETED_IMMUTABLE', 'This ride is completed and can no longer be booked')
    if (ride.status === 'CANCELLED') return fail(409, 'RIDE_NOT_OPEN', 'This ride was cancelled')
    if (bookings.some((b) => b.rideId === ride.id && b.riderId === me && b.status === 'CONFIRMED')) {
      return fail(409, 'ALREADY_BOOKED', 'You already hold a seat on this ride')
    }
    // The last-seat guarantee. Node is single-threaded here, which gives the
    // same all-or-nothing claim a conditional UPDATE gives in Postgres.
    if (seatsTaken(ride.id) >= ride.seatsTotal) return fail(409, 'NO_SEATS_AVAILABLE', 'No seats remaining')

    const booking = {
      id: `eeeeeeee-eeee-4eee-8eee-${String(++bookingSeq).padStart(12, '0')}`,
      rideId: ride.id,
      riderId: me,
      status: 'CONFIRMED',
      seatShare: '0.00',
      amountOwed: '0.00',
      createdAt: new Date().toISOString(),
      cancelledAt: null,
      cancellationReason: null,
    }
    bookings.push(booking)
    recalculate(ride.id)
    return send(201, { booking })
  }

  match = path.match(/^\/bookings\/([^/]+)\/cancel$/)
  if (match) {
    const booking = bookings.find((b) => b.id === match[1])
    if (!booking) return fail(404, 'BOOKING_NOT_FOUND', 'Booking not found')
    const ride = rides[booking.rideId]
    if (booking.riderId !== me && ride.driverId !== me) return fail(404, 'BOOKING_NOT_FOUND', 'Booking not found')
    if (booking.status !== 'CONFIRMED') return fail(409, 'CONFLICT', 'Already cancelled')

    booking.status = booking.riderId === me ? 'CANCELLED_BY_RIDER' : 'CANCELLED_BY_DRIVER'
    booking.amountOwed = '0.00'
    booking.cancelledAt = new Date().toISOString()
    booking.cancellationReason = body.reason ?? null
    recalculate(ride.id)
    return send(200, { booking, seatsAvailable: ride.seatsTotal - seatsTaken(ride.id) })
  }

  match = path.match(/^\/rides\/([^/]+)(\/(cancel|complete))?$/)
  if (match) {
    const ride = rides[match[1]]
    if (!ride) return fail(404, 'RIDE_NOT_FOUND', 'Ride not found')
    if (!match[3]) return send(200, { ride: shapeRide(ride, me) })
    if (ride.driverId !== me) return fail(404, 'RIDE_NOT_FOUND', 'Ride not found')
    if (ride.status === 'COMPLETED') return fail(409, 'RIDE_COMPLETED_IMMUTABLE', 'This ride is completed and can no longer be modified')

    if (match[3] === 'complete') {
      ride.status = 'COMPLETED'
      ride.completedAt = new Date().toISOString()
      return send(200, { ride: shapeRide(ride, me) })
    }

    const count = confirmed(ride.id).length
    for (const b of confirmed(ride.id)) {
      b.status = 'CANCELLED_BY_DRIVER'
      b.amountOwed = '0.00'
      b.cancelledAt = new Date().toISOString()
      b.cancellationReason = body.reason ?? null
    }
    ride.status = 'CANCELLED'
    ride.cancelledAt = new Date().toISOString()
    return send(200, { ride: shapeRide(ride, me), bookingsCancelled: count })
  }

  return fail(404, 'NOT_FOUND', `Unmapped ${path}`)
}).listen(PORT, () => console.log(`stub API listening on ${PORT}`))

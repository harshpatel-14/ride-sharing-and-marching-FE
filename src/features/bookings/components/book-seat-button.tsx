'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
  buttonVariants,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { useBookSeat, type SeatConflict } from '../hooks/use-bookings'

/**
 * Claim a seat, and recover gracefully when someone else got it first.
 *
 * The in-flight state is the only optimism here: it reflects the rider's
 * INTENT, not the outcome. The seat count is untouched until the server says
 * otherwise. (spec §3.3, docs/API.md)
 */
export function BookSeatButton({
  rideId,
  seatsAvailable,
  searchHref,
}: {
  rideId: string
  seatsAvailable: number
  /** Where to send a rider who lost the seat — ideally their original search. */
  searchHref?: string
}) {
  const [conflict, setConflict] = useState<SeatConflict | null>(null)
  const bookSeat = useBookSeat(rideId, { onConflict: setConflict })

  const lastSeat = seatsAvailable === 1

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => bookSeat.mutate()} disabled={bookSeat.isPending} size="lg">
          {bookSeat.isPending ? <Spinner label="Booking your seat" /> : null}
          {bookSeat.isPending ? 'Booking…' : 'Book a seat'}
        </Button>
        {lastSeat ? (
          <p className="text-sm text-warning">
            Last seat — someone else may be booking it right now.
          </p>
        ) : null}
      </div>

      <Dialog open={conflict !== null} onOpenChange={(open) => !open && setConflict(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {conflict?.kind === 'already-booked' ? 'You already have a seat' : 'That seat just went'}
            </DialogTitle>
            <DialogDescription>
              {conflict?.kind === 'already-booked'
                ? 'You already hold a confirmed seat on this ride.'
                : 'Another rider confirmed the last seat a moment before you. Nothing was charged, and the seat count above has been refreshed.'}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            {conflict?.kind === 'already-booked' ? (
              <Link href="/bookings" className={cn(buttonVariants({ variant: 'primary' }))}>
                View my booking
              </Link>
            ) : (
              <>
                <Button variant="outline" onClick={() => setConflict(null)}>
                  Stay here
                </Button>
                <Link
                  href={searchHref ?? '/search'}
                  className={cn(buttonVariants({ variant: 'primary' }))}
                >
                  Find a similar ride
                </Link>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

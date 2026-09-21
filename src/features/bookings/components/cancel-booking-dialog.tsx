'use client'

import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  Input,
  Spinner,
} from '@/components/ui'
import { useCancelBooking } from '../hooks/use-bookings'

export function CancelBookingDialog({
  bookingId,
  rideId,
  label = 'Cancel booking',
}: {
  bookingId: string
  rideId: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const cancelBooking = useCancelBooking(bookingId, rideId)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setReason('')
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {label}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this booking?</DialogTitle>
          <DialogDescription>
            The seat becomes available again immediately, and the remaining riders’ shares are
            recalculated — each of them will pay more.
          </DialogDescription>
        </DialogHeader>

        <Field label="Reason (optional)">
          {(props) => (
            <Input
              {...props}
              value={reason}
              placeholder="Plans changed"
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </Field>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={cancelBooking.isPending}>
              Keep it
            </Button>
          </DialogClose>
          <Button
            variant="danger"
            disabled={cancelBooking.isPending}
            onClick={async () => {
              try {
                await cancelBooking.mutateAsync(reason.trim() === '' ? undefined : reason.trim())
                setOpen(false)
              } catch {
                // The mutation surfaces its own message; keep the dialog open.
              }
            }}
          >
            {cancelBooking.isPending ? <Spinner label="Cancelling" /> : null}
            Cancel booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

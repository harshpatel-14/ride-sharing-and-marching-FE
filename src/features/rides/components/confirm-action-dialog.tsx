'use client'

import { useState, type ReactNode } from 'react'
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

/**
 * Confirmation for an action that cannot be undone.
 *
 * Cancelling a ride cancels every confirmed booking on it, and completing one
 * locks it permanently (spec §3.4, §3.6). Neither should be a stray click
 * away. The optional reason is passed straight through to the API, which
 * stores it on each cancelled booking so riders learn why.
 */
export function ConfirmActionDialog({
  trigger,
  title,
  description,
  confirmLabel,
  variant = 'danger',
  pending,
  withReason,
  reasonLabel = 'Reason (optional)',
  reasonPlaceholder,
  onConfirm,
}: {
  trigger: ReactNode
  title: string
  description: string
  confirmLabel: string
  variant?: 'danger' | 'primary'
  pending?: boolean
  withReason?: boolean
  reasonLabel?: string
  reasonPlaceholder?: string
  onConfirm: (reason?: string) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setReason('')
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {withReason ? (
          <Field label={reasonLabel}>
            {(props) => (
              <Input
                {...props}
                value={reason}
                placeholder={reasonPlaceholder ?? ''}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
          </Field>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Keep it
            </Button>
          </DialogClose>
          <Button
            variant={variant}
            disabled={pending}
            onClick={async () => {
              try {
                await onConfirm(reason.trim() === '' ? undefined : reason.trim())
                setOpen(false)
              } catch {
                // The mutation surfaces its own message; keep the dialog open
                // so the user can see what happened and decide again.
              }
            }}
          >
            {pending ? <Spinner label={confirmLabel} /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

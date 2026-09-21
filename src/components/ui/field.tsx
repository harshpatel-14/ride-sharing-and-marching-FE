import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

/**
 * A labelled form control with its error wired up via aria-describedby.
 *
 * Errors are rendered in an aria-live region so a screen reader announces a
 * validation failure instead of silently leaving the user on a form that will
 * not submit.
 */
export function Field({
  label,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string
  error?: string | undefined
  hint?: string | undefined
  required?: boolean | undefined
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }) => ReactNode
  className?: string | undefined
}) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </Label>

      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}

      {hint ? (
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}

      {/*
        The node is always present so the layout does not shift when an error
        appears, but it only takes `role="alert"` when it actually has
        something to announce. A page full of empty assertive live regions is
        noise for a screen reader, and it makes "find the error" ambiguous for
        anything querying the DOM.
      */}
      <p
        id={errorId}
        {...(error ? { role: 'alert' } : {})}
        className={cn('text-xs text-danger', !error && 'sr-only')}
      >
        {error ?? ''}
      </p>
    </div>
  )
}

'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { Button, Field, Input, Spinner } from '@/components/ui'
import { isValidation, toFieldMessages, toUserMessage } from '@/lib/api'
import { useRegister } from '../hooks/use-auth'
import { PASSWORD_MIN_LENGTH, registerSchema, type RegisterFormValues } from '../schemas'

export function RegisterForm() {
  const registerMutation = useRegister()

  const {
    register: field,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', phone: '', password: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    // confirmPassword is a form concern; it never goes on the wire.
    const { confirmPassword: _confirm, ...input } = values

    try {
      await registerMutation.mutateAsync(input)
    } catch (error) {
      if (isValidation(error)) {
        for (const [name, message] of Object.entries(toFieldMessages(error))) {
          setError(name as keyof RegisterFormValues, { message: String(message) })
        }
        return
      }
      setError('root', { message: toUserMessage(error) })
    }
  })

  const pending = isSubmitting || registerMutation.isPending

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {errors.root ? (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {errors.root.message}
        </p>
      ) : null}

      <Field label="Full name" required error={errors.fullName?.message}>
        {(props) => <Input {...props} autoComplete="name" autoFocus {...field('fullName')} />}
      </Field>

      <Field label="Email" required error={errors.email?.message}>
        {(props) => <Input {...props} type="email" autoComplete="email" {...field('email')} />}
      </Field>

      <Field
        label="Phone"
        required
        error={errors.phone?.message}
        hint="Shared with a driver or rider only once a booking is confirmed."
      >
        {(props) => <Input {...props} type="tel" autoComplete="tel" placeholder="+91 98111 00001" {...field('phone')} />}
      </Field>

      <Field
        label="Password"
        required
        error={errors.password?.message}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. A passphrase is easier to remember and harder to guess.`}
      >
        {(props) => <Input {...props} type="password" autoComplete="new-password" {...field('password')} />}
      </Field>

      <Field label="Confirm password" required error={errors.confirmPassword?.message}>
        {(props) => <Input {...props} type="password" autoComplete="new-password" {...field('confirmPassword')} />}
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Spinner label="Creating account" /> : null}
        {pending ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-center text-sm text-fg-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-brand underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}

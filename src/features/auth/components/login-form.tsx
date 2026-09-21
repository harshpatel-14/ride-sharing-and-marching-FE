'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { Button, Field, Input, Spinner } from '@/components/ui'
import { isValidation, toFieldMessages, toUserMessage } from '@/lib/api'
import { useLogin } from '../hooks/use-auth'
import { loginSchema, type LoginInput } from '../schemas'

export function LoginForm({ next }: { next?: string | undefined }) {
  const loginMutation = useLogin(next)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await loginMutation.mutateAsync(values)
    } catch (error) {
      if (isValidation(error)) {
        for (const [field, message] of Object.entries(toFieldMessages(error))) {
          setError(field as keyof LoginInput, { message: String(message) })
        }
        return
      }
      // INVALID_CREDENTIALS is deliberately vague about which field was wrong:
      // saying "no such email" turns the form into an account-existence oracle.
      setError('root', { message: toUserMessage(error) })
    }
  })

  const pending = isSubmitting || loginMutation.isPending

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {errors.root ? (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {errors.root.message}
        </p>
      ) : null}

      <Field label="Email" required error={errors.email?.message}>
        {(props) => (
          <Input {...props} type="email" autoComplete="email" autoFocus {...register('email')} />
        )}
      </Field>

      <Field label="Password" required error={errors.password?.message}>
        {(props) => (
          <Input {...props} type="password" autoComplete="current-password" {...register('password')} />
        )}
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Spinner label="Signing in" /> : null}
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>

      <p className="text-center text-sm text-fg-muted">
        No account?{' '}
        <Link href="/register" className="text-brand underline-offset-2 hover:underline">
          Create one
        </Link>
      </p>
    </form>
  )
}

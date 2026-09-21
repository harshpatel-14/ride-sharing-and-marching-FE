'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Button, Field, Input, Spinner } from '@/components/ui'
import { PlaceField } from '@/components/form'
import { RIDE } from '@/config/constants'
import { isValidation, toFieldMessages } from '@/lib/api'
import { useCreateRide } from '../hooks/use-ride-mutations'
import {
  minDepartureLocal,
  rideFormSchema,
  toCreateRideInput,
  type RideFormParsed,
  type RideFormValues,
} from '../schemas/ride-form'

const EMPTY_PLACE = { label: '', coords: { lat: Number.NaN, lng: Number.NaN } }

/** Flat wire field -> nested form path, for mapping backend validation errors. */
const WIRE_TO_FORM_FIELD: Record<string, string> = {
  originLabel: 'origin.label',
  originLat: 'origin.coords.lat',
  originLng: 'origin.coords.lng',
  destLabel: 'destination.label',
  destLat: 'destination.coords.lat',
  destLng: 'destination.coords.lng',
  departureAt: 'departureLocal',
}

export function RideForm() {
  const createRide = useCreateRide()

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RideFormValues, unknown, RideFormParsed>({
    resolver: zodResolver(rideFormSchema),
    defaultValues: {
      origin: EMPTY_PLACE,
      destination: EMPTY_PLACE,
      departureLocal: '',
      flexMinutes: RIDE.DEFAULT_FLEX_MINUTES,
      seatsTotal: 1,
      estimatedCost: '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createRide.mutateAsync(toCreateRideInput(values))
    } catch (error: unknown) {
      // The backend validates independently (spec §6). When it rejects
      // something the client schema allowed, show it against the right field
      // rather than as an anonymous toast.
      if (isValidation(error)) {
        // details[].field is a dotted path that usually maps straight onto a
        // form field — but the wire names are flat (originLabel) while the
        // form is nested (origin.label), so translate before setting.
        for (const [wireField, message] of Object.entries(toFieldMessages(error))) {
          setError(
            (WIRE_TO_FORM_FIELD[wireField] ?? wireField) as keyof RideFormValues,
            { message: String(message) },
          )
        }
      }
    }
  })

  const pending = isSubmitting || createRide.isPending

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Controller
        control={control}
        name="origin"
        render={({ field }) => (
          <PlaceField
            legend="Origin"
            required
            value={field.value}
            onChange={field.onChange}
            errors={{
              label: errors.origin?.label?.message,
              lat: errors.origin?.coords?.lat?.message,
              lng: errors.origin?.coords?.lng?.message,
            }}
          />
        )}
      />

      <Controller
        control={control}
        name="destination"
        render={({ field }) => (
          <PlaceField
            legend="Destination"
            required
            value={field.value}
            onChange={field.onChange}
            errors={{
              label: errors.destination?.label?.message,
              lat: errors.destination?.coords?.lat?.message,
              lng: errors.destination?.coords?.lng?.message,
            }}
          />
        )}
      />

      <Field
        label="Departure"
        required
        error={errors.departureLocal?.message}
        hint={`Must be at least ${RIDE.MIN_LEAD_TIME_MINUTES} minutes from now.`}
      >
        {(props) => (
          <Input {...props} type="datetime-local" min={minDepartureLocal()} {...register('departureLocal')} />
        )}
      </Field>

      <Field
        label="Time flexibility (minutes)"
        error={errors.flexMinutes?.message}
        hint="Widens the window your ride is matched against. Setting 30 puts you in materially more searches than 0."
      >
        {(props) => (
          <Input
            {...props}
            type="number"
            inputMode="numeric"
            min={0}
            max={RIDE.MAX_FLEX_MINUTES}
            {...register('flexMinutes')}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Seats" required error={errors.seatsTotal?.message}>
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="numeric"
              min={RIDE.MIN_SEATS}
              max={RIDE.MAX_SEATS}
              {...register('seatsTotal')}
            />
          )}
        </Field>

        <Field
          label="Estimated cost (₹)"
          required
          error={errors.estimatedCost?.message}
          hint="For the whole ride. The server splits it across confirmed riders."
        >
          {(props) => (
            <Input {...props} inputMode="decimal" placeholder="300" {...register('estimatedCost')} />
          )}
        </Field>
      </div>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? <Spinner label="Posting ride" /> : null}
        {pending ? 'Posting…' : 'Post ride'}
      </Button>
    </form>
  )
}

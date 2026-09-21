'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Search } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Button, Field, Input, Spinner } from '@/components/ui'
import { PlaceField } from '@/components/form'
import { RIDE, SEARCH } from '@/config/constants'
import {
  defaultSearchFormValues,
  fromSearchQuery,
  searchFormSchema,
  toSearchQuery,
  type SearchFormParsed,
  type SearchFormValues,
} from '../schemas/search-form'
import type { SearchQuery } from '../schemas'
import { useSearchQuery } from '../hooks/use-search-query'

const RADIUS_PRESETS = [1_000, 3_000, 5_000, 10_000, 25_000] as const

export function SearchForm({ initial, pending }: { initial: SearchQuery | null; pending?: boolean }) {
  const { submit } = useSearchQuery()

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SearchFormValues, unknown, SearchFormParsed>({
    resolver: zodResolver(searchFormSchema),
    defaultValues: initial ? fromSearchQuery(initial) : defaultSearchFormValues(),
  })

  // useWatch, not watch(): watch() returns a fresh function each render and
  // cannot be memoized safely.
  const radius = useWatch({ control, name: 'radiusMeters' })

  const onSubmit = handleSubmit((values) => submit(toSearchQuery(values)))

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Controller
        control={control}
        name="origin"
        render={({ field }) => (
          <PlaceField
            legend="From"
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
            legend="To"
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

      <fieldset className="space-y-3 rounded-card border border-border p-3">
        <legend className="px-1 text-sm font-medium">Departing between</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Earliest" required error={errors.departAfterLocal?.message}>
            {(props) => <Input {...props} type="datetime-local" {...register('departAfterLocal')} />}
          </Field>
          <Field
            label="Latest"
            required
            error={errors.departBeforeLocal?.message}
            hint={`At most ${SEARCH.MAX_WINDOW_HOURS} hours wide.`}
          >
            {(props) => <Input {...props} type="datetime-local" {...register('departBeforeLocal')} />}
          </Field>
        </div>
      </fieldset>

      <Field
        label="Search radius"
        error={errors.radiusMeters?.message}
        hint="Applied to BOTH ends of the route — a ride matching only your pickup is not a match."
      >
        {(props) => (
          <div className="space-y-2">
            <Input
              {...props}
              type="range"
              min={SEARCH.MIN_RADIUS_METERS}
              max={SEARCH.MAX_RADIUS_METERS}
              step={100}
              className="h-10 px-0"
              {...register('radiusMeters')}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm tabular-nums text-fg-muted">
                {Number(radius) >= 1000 ? `${(Number(radius) / 1000).toFixed(1)} km` : `${radius} m`}
              </span>
              {RADIUS_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setValue('radiusMeters', preset, { shouldValidate: true })}
                  className="rounded-full border border-border px-2 py-0.5 text-xs text-fg-muted hover:bg-surface-muted"
                >
                  {preset / 1000} km
                </button>
              ))}
            </div>
          </div>
        )}
      </Field>

      <Field label="Seats needed" error={errors.seats?.message}>
        {(props) => (
          <Input
            {...props}
            type="number"
            inputMode="numeric"
            min={RIDE.MIN_SEATS}
            max={RIDE.MAX_SEATS}
            {...register('seats')}
          />
        )}
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Spinner label="Searching" /> : <Search className="size-4" aria-hidden />}
        {pending ? 'Searching…' : 'Search rides'}
      </Button>
    </form>
  )
}

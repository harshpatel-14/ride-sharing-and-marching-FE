'use client'

import { Field, Input } from '@/components/ui'
import type { LatLng } from '@/lib/geo'

/**
 * Origin / destination entry.
 *
 * PHASE 5 REPLACES THE INSIDE OF THIS COMPONENT with a debounced geocoder
 * autocomplete over `lib/geo`'s GeoProvider. The props are already shaped in
 * the provider-neutral `Place` vocabulary, so that swap does not ripple: the
 * ride form, and later the search form, keep working unchanged.
 *
 * Until then the coordinates are entered directly, which is unglamorous but
 * keeps the contract with the backend's matching query honest from day one.
 */
export interface PlaceFieldValue {
  label: string
  coords: LatLng
}

export function PlaceField({
  legend,
  value,
  onChange,
  errors,
  required,
}: {
  legend: string
  value: PlaceFieldValue
  onChange: (next: PlaceFieldValue) => void
  errors?: { label?: string | undefined; lat?: string | undefined; lng?: string | undefined }
  required?: boolean | undefined
}) {
  return (
    <fieldset className="space-y-3 rounded-card border border-border p-3">
      <legend className="px-1 text-sm font-medium">{legend}</legend>

      <Field label="Place name" error={errors?.label} required={required}>
        {(props) => (
          <Input
            {...props}
            value={value.label}
            placeholder="Iscon Cross Road, Ahmedabad"
            onChange={(e) => onChange({ ...value, label: e.target.value })}
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude" error={errors?.lat} required={required}>
          {(props) => (
            <Input
              {...props}
              type="number"
              step="any"
              inputMode="decimal"
              value={Number.isNaN(value.coords.lat) ? '' : value.coords.lat}
              placeholder="23.0225"
              onChange={(e) =>
                onChange({ ...value, coords: { ...value.coords, lat: e.target.valueAsNumber } })
              }
            />
          )}
        </Field>

        <Field label="Longitude" error={errors?.lng} required={required}>
          {(props) => (
            <Input
              {...props}
              type="number"
              step="any"
              inputMode="decimal"
              value={Number.isNaN(value.coords.lng) ? '' : value.coords.lng}
              placeholder="72.5714"
              onChange={(e) =>
                onChange({ ...value, coords: { ...value.coords, lng: e.target.valueAsNumber } })
              }
            />
          )}
        </Field>
      </div>
    </fieldset>
  )
}

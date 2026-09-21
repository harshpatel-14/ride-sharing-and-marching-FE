'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Field, Input, Spinner } from '@/components/ui'
import { SEARCH } from '@/config/constants'
import { getGeoProvider, type LatLng, type Place } from '@/lib/geo'
import { cn } from '@/lib/utils'

/**
 * Origin / destination entry. (§8)
 *
 * Two modes, decided by whether a geocoder is configured:
 *
 *  - configured   -> debounced autocomplete over the GeoProvider
 *  - not configured -> manual latitude/longitude entry
 *
 * The manual mode is not a placeholder to be embarrassed about. Coordinates
 * are what the backend's matching query uses; the label is display only. So
 * the fallback produces exactly the same wire payload as the autocomplete,
 * which is why swapping geocoders later cannot ripple into the forms.
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
  near,
}: {
  legend: string
  value: PlaceFieldValue
  onChange: (next: PlaceFieldValue) => void
  errors?: { label?: string | undefined; lat?: string | undefined; lng?: string | undefined }
  required?: boolean | undefined
  /** Biases suggestions towards the current map viewport. */
  near?: LatLng | undefined
}) {
  const provider = getGeoProvider()
  const listId = useId()
  const [suggestions, setSuggestions] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const pickedRef = useRef(false)

  const query = value.label

  useEffect(() => {
    if (!provider) return
    // A suggestion was just picked: that keystroke came from us, not the user.
    if (pickedRef.current) {
      pickedRef.current = false
      return
    }

    // Everything runs inside the debounce, including clearing a too-short
    // query. One code path, and no setState synchronously inside the effect
    // (which would cascade renders on every keystroke).
    const timer = setTimeout(() => {
      if (query.trim().length < 3) {
        setSuggestions([])
        setOpen(false)
        return
      }

      // Cancel the previous lookup: geocoding is usually billed per call, and
      // a request per keystroke is both slow and rude to the provider.
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setSearching(true)

      void provider
        .search(query, near, controller.signal)
        .then((places) => {
          setSuggestions(places)
          setOpen(places.length > 0)
        })
        .catch(() => setSuggestions([]))
        .finally(() => setSearching(false))
    }, SEARCH.GEOCODER_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [provider, query, near])

  useEffect(() => () => abortRef.current?.abort(), [])

  function pick(place: Place) {
    pickedRef.current = true
    onChange({ label: place.label, coords: place.coords })
    setOpen(false)
    setSuggestions([])
  }

  const hasCoords = !Number.isNaN(value.coords.lat) && !Number.isNaN(value.coords.lng)

  return (
    <fieldset className="space-y-3 rounded-card border border-border p-3">
      <legend className="px-1 text-sm font-medium">{legend}</legend>

      <div className="relative">
        <Field
          label={provider ? 'Search for a place' : 'Place name'}
          error={errors?.label}
          required={required}
        >
          {(props) => (
            <div className="relative">
              <Input
                {...props}
                value={value.label}
                placeholder="Prahlad Nagar, Ahmedabad"
                autoComplete="off"
                role={provider ? 'combobox' : undefined}
                aria-expanded={provider ? open : undefined}
                aria-controls={provider ? listId : undefined}
                onChange={(e) => onChange({ ...value, label: e.target.value })}
                onFocus={() => setOpen(suggestions.length > 0)}
                // Delayed so a click on a suggestion registers before blur closes it.
                onBlur={() => setTimeout(() => setOpen(false), 150)}
              />
              {searching ? (
                <span className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Spinner label="Searching places" />
                </span>
              ) : null}
            </div>
          )}
        </Field>

        {provider && open ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-surface shadow-lg"
          >
            {suggestions.map((place) => (
              <li key={place.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => pick(place)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted"
                >
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-fg-muted" aria-hidden />
                  <span>{place.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/*
        Coordinates stay visible even with a geocoder: they are what actually
        gets matched, and hiding them would make a mis-picked place impossible
        to diagnose. Read-only once picked, editable when entering by hand.
      */}
      <div className={cn('grid grid-cols-2 gap-3', provider && hasCoords && 'opacity-80')}>
        <Field label="Latitude" error={errors?.lat} required={required}>
          {(props) => (
            <Input
              {...props}
              type="number"
              step="any"
              inputMode="decimal"
              value={Number.isNaN(value.coords.lat) ? '' : value.coords.lat}
              placeholder="23.0103"
              onChange={(e) => onChange({ ...value, coords: { ...value.coords, lat: e.target.valueAsNumber } })}
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
              placeholder="72.5074"
              onChange={(e) => onChange({ ...value, coords: { ...value.coords, lng: e.target.valueAsNumber } })}
            />
          )}
        </Field>
      </div>
    </fieldset>
  )
}

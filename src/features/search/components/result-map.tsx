'use client'

import { useEffect, useRef } from 'react'
import type { Map as MapLibreMap, Marker } from 'maplibre-gl'
import type { SearchResult } from '../schemas'

/**
 * Map pane. (§7, §14)
 *
 * Renders the SAME array the list renders — the map never has its own data
 * source, so the two panes cannot disagree about what matched.
 *
 * MapLibre is ~200KB, so this module is only ever reached through
 * next/dynamic with ssr:false (see result-pane.tsx). It is also entirely
 * optional: without NEXT_PUBLIC_MAP_STYLE_URL the pane is not rendered at all
 * and the list stands on its own.
 */
export default function ResultMap({
  results,
  origin,
  destination,
  activeId,
  styleUrl,
}: {
  results: SearchResult[]
  origin: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  activeId: string | null
  styleUrl: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Marker[]>([])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    void (async () => {
      const maplibre = await import('maplibre-gl')
      if (cancelled || !containerRef.current) return

      const map = new maplibre.Map({
        container: containerRef.current,
        style: styleUrl,
        center: [origin.lng, origin.lat],
        zoom: 10,
      })
      map.addControl(new maplibre.NavigationControl(), 'top-right')
      mapRef.current = map
    })()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [styleUrl, origin.lat, origin.lng])

  // Markers follow the results, and the endpoints the rider actually asked for.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let cancelled = false

    void (async () => {
      const maplibre = await import('maplibre-gl')
      if (cancelled) return

      for (const marker of markersRef.current) marker.remove()
      markersRef.current = []

      const add = (lng: number, lat: number, colour: string, label: string) => {
        const marker = new maplibre.Marker({ color: colour })
          .setLngLat([lng, lat])
          .setPopup(new maplibre.Popup({ offset: 24 }).setText(label))
          .addTo(map)
        markersRef.current.push(marker)
      }

      add(origin.lng, origin.lat, '#2563eb', 'Your pickup')
      add(destination.lng, destination.lat, '#16a34a', 'Your drop-off')

      for (const result of results) {
        add(
          result.origin.lng,
          result.origin.lat,
          result.id === activeId ? '#f59e0b' : '#64748b',
          `${result.origin.label} → ${result.destination.label}`,
        )
      }

      const bounds = new maplibre.LngLatBounds(
        [origin.lng, origin.lat],
        [origin.lng, origin.lat],
      )
      bounds.extend([destination.lng, destination.lat])
      for (const result of results) bounds.extend([result.origin.lng, result.origin.lat])
      map.fitBounds(bounds, { padding: 56, maxZoom: 13, duration: 0 })
    })()

    return () => {
      cancelled = true
    }
  }, [results, activeId, origin.lat, origin.lng, destination.lat, destination.lng])

  return <div ref={containerRef} className="h-full min-h-80 w-full rounded-card" aria-label="Map of matching rides" />
}

import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { makeSearchResult } from '@/mocks'
import { server } from '@/mocks/server'
import { renderWithProviders, screen } from '@/test/render'
import type { SearchQuery } from '../schemas'
import { SearchResults } from './search-results'

const query: SearchQuery = {
  originLat: 23.0103,
  originLng: 72.5074,
  destLat: 23.0364,
  destLng: 72.529,
  departAfter: new Date().toISOString(),
  departBefore: new Date(Date.now() + 4 * 3_600_000).toISOString(),
  radiusMeters: 5_000,
  seats: 1,
  limit: 20,
}

const serve = (rides: unknown[]) =>
  server.use(
    http.get('*/rides/search', () =>
      HttpResponse.json({ rides, searchedAt: new Date().toISOString() }),
    ),
  )

describe('SearchResults', () => {
  /**
   * estimatedShare is what this rider would actually pay; estimatedCost is the
   * whole ride. Leading with the wrong one quotes people a number they will
   * never be charged.
   */
  it('leads with the rider’s share, not the whole-ride cost', async () => {
    serve([makeSearchResult({ estimatedCost: '320.00', estimatedShare: '160.00' })])
    renderWithProviders(<SearchResults query={query} />)

    const share = await screen.findByText('₹160.00')
    expect(share).toBeVisible()
    expect(screen.getByText(/your share/i)).toBeVisible()
    // The total is still shown, but as secondary context.
    expect(screen.getByText(/₹320\.00 total/)).toBeVisible()
  })

  it('never renders contact details for a search result (§9, spec §3.7)', async () => {
    serve([makeSearchResult()])
    renderWithProviders(<SearchResults query={query} />)

    await screen.findByText('₹160.00')
    expect(screen.queryByText(/\+91/)).not.toBeInTheDocument()
    expect(screen.queryByText(/@example\.com/)).not.toBeInTheDocument()
  })

  it('labels how far each end is from the requested points', async () => {
    serve([makeSearchResult({ originMeters: 420, destMeters: 2_400 })])
    renderWithProviders(<SearchResults query={query} />)

    expect(await screen.findByText(/420 m from pickup/)).toBeVisible()
    expect(screen.getByText(/2\.4 km from drop-off/)).toBeVisible()
  })

  /**
   * An empty result is the most confusing state in this product: the rider
   * can see rides exist, just not theirs. The copy has to explain that
   * matching needs BOTH endpoints AND the time to overlap.
   */
  it('explains why nothing matched rather than just saying "no results"', async () => {
    serve([])
    renderWithProviders(<SearchResults query={query} />)

    expect(await screen.findByText(/no rides match yet/i)).toBeVisible()
    expect(screen.getByText(/BOTH ends of your route/i)).toBeVisible()
  })

  it('renders every result the server returned, in the order given', async () => {
    serve([
      makeSearchResult({ id: '00000000-0000-4000-8000-000000000001', estimatedShare: '100.00' }),
      makeSearchResult({ id: '00000000-0000-4000-8000-000000000002', estimatedShare: '200.00' }),
      makeSearchResult({ id: '00000000-0000-4000-8000-000000000003', estimatedShare: '300.00' }),
    ])
    renderWithProviders(<SearchResults query={query} />)

    await screen.findByText('₹100.00')
    const shares = screen.getAllByText(/^₹\d00\.00$/).map((el) => el.textContent)
    // Not re-sorted client-side: the backend's ranking is the answer. (§7)
    expect(shares).toEqual(['₹100.00', '₹200.00', '₹300.00'])
    expect(screen.getByText(/3 matching rides/i)).toBeVisible()
  })

  it('surfaces a failed search as a message, not a blank pane', async () => {
    server.use(
      http.get('*/rides/search', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'boom' }, requestId: 'r' },
          { status: 500 },
        ),
      ),
    )
    renderWithProviders(<SearchResults query={query} />)
    expect(await screen.findByText(/something went wrong/i)).toBeVisible()
  })
})

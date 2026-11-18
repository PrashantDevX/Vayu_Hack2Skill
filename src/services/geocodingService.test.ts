import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { searchCities } from './geocodingService'
import { cacheClear } from './cache'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  cacheClear()
  vi.unstubAllGlobals()
})

afterEach(() => vi.unstubAllGlobals())

describe('city search', () => {
  it('returns normalized places and drops unknown optional fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          results: [
            { name: 'New Delhi', latitude: 28.61, longitude: 77.21, admin1: 'Delhi', country: 'India' },
            { name: 'Delhi', latitude: 28.7, longitude: 77.1 },
          ],
        }),
      ),
    )

    const places = await searchCities('  delhi  ')
    expect(places).toHaveLength(2)
    expect(places[0]).toEqual({
      name: 'New Delhi',
      admin1: 'Delhi',
      country: 'India',
      latitude: 28.61,
      longitude: 77.21,
    })
    expect(places[1]?.admin1).toBeNull()
    expect(places[1]?.country).toBeNull()
  })

  it('skips the network for short queries and returns an empty list', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await searchCities('d')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('handles a provider response without a results array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})))
    expect(await searchCities('pune')).toEqual([])
  })

  it('caches identical searches and encodes the query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await searchCities('New Delhi')
    await searchCities('new delhi')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('name=New%20Delhi')
  })

  it('throws a clear error for an unexpected payload or provider failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ results: 'nope' })))
    await expect(searchCities('mumbai')).rejects.toThrow('unexpected response')

    cacheClear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: true }, 500)))
    await expect(searchCities('mumbai')).rejects.toThrow()
  })
})

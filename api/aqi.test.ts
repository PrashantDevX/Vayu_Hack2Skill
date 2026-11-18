/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from './aqi'
import { clearRateLimits } from './lib/rateLimit'

function request(city = 'New Delhi', ip = '10.2.0.1', method = 'GET') {
  return new Request(`https://vayu.test/api/aqi?city=${encodeURIComponent(city)}`, {
    method,
    headers: { 'x-forwarded-for': ip },
  })
}

function providerResponse(records: unknown[], status = 200): Response {
  return new Response(JSON.stringify({ records }), { status, headers: { 'Content-Type': 'application/json' } })
}

interface OfficialResponse {
  available: boolean
  reason?: string
  aqi?: number
  station?: string
  distanceKm?: number | null
  provider?: string
}

beforeEach(() => {
  clearRateLimits()
  delete process.env.DATA_GOV_IN_API_KEY
  delete process.env.DATA_GOV_IN_RESOURCE_ID
  vi.unstubAllGlobals()
})

afterEach(() => {
  delete process.env.DATA_GOV_IN_API_KEY
  delete process.env.DATA_GOV_IN_RESOURCE_ID
  vi.unstubAllGlobals()
})

describe('GET /api/aqi', () => {
  it('reports official data as unavailable when credentials are absent', async () => {
    const response = await handler(request('New Delhi', '10.2.0.2'))
    expect(response.status).toBe(200)
    const data = (await response.json()) as OfficialResponse
    expect(data.available).toBe(false)
    expect(data.reason).toContain('not configured')
  })

  it('requires a city and rejects non-GET methods', async () => {
    expect((await handler(request('', '10.2.0.3'))).status).toBe(400)
    expect((await handler(request('Delhi', '10.2.0.4', 'POST'))).status).toBe(405)
  })

  it('normalizes a usable official AQI record', async () => {
    process.env.DATA_GOV_IN_API_KEY = 'test-key'
    process.env.DATA_GOV_IN_RESOURCE_ID = 'test-resource'
    const fetchMock = vi.fn().mockResolvedValue(
      providerResponse([
        { city: 'Gurugram', aqi: '312', station: 'Anand Vihar', last_update: '2026-11-18 10:00:00' },
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await handler(request('Gurugram', '10.2.0.5'))
    const data = (await response.json()) as OfficialResponse
    expect(data.available).toBe(true)
    expect(data.aqi).toBe(312)
    expect(data.station).toBe('Anand Vihar')
    expect(data.provider).toContain('official')
    expect(data.distanceKm).toBeNull()
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('api.data.gov.in')
  })

  it('passes through a station distance only when the provider supplies a sane value', async () => {
    process.env.DATA_GOV_IN_API_KEY = 'test-key'
    process.env.DATA_GOV_IN_RESOURCE_ID = 'test-resource'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        providerResponse([
          { city: 'Pune', aqi: '145', station: 'Shivajinagar', distance_km: '3.44' },
          { city: 'Pune', aqi: '150', distance_km: '9999' },
        ]),
      ),
    )

    const data = (await (await handler(request('Pune', '10.2.0.9'))).json()) as OfficialResponse
    expect(data.distanceKm).toBe(3.4)
  })

  it('does not convert pollutant-only records into an official AQI', async () => {
    process.env.DATA_GOV_IN_API_KEY = 'test-key'
    process.env.DATA_GOV_IN_RESOURCE_ID = 'test-resource'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(providerResponse([{ city: 'Mumbai', pm2_5: '90' }])))
    const data = (await (await handler(request('Mumbai', '10.2.0.6'))).json()) as OfficialResponse
    expect(data.available).toBe(false)
    expect(data.reason).toContain('no record contained a usable AQI')
  })

  it('handles provider failures and caches results by city', async () => {
    process.env.DATA_GOV_IN_API_KEY = 'test-key'
    process.env.DATA_GOV_IN_RESOURCE_ID = 'test-resource'
    const fetchMock = vi.fn().mockResolvedValue(providerResponse([], 500))
    vi.stubGlobal('fetch', fetchMock)
    const failed = (await (await handler(request('Kolkata', '10.2.0.7'))).json()) as OfficialResponse
    expect(failed.available).toBe(false)

    const cachedFetch = vi.fn().mockResolvedValue(providerResponse([{ city: 'Chennai', aqi: 120 }]))
    vi.stubGlobal('fetch', cachedFetch)
    await handler(request('Chennai', '10.2.0.8'))
    await handler(request('Chennai', '10.2.0.8'))
    expect(cachedFetch).toHaveBeenCalledTimes(1)
  })
})

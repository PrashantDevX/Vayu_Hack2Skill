/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler, { clearOfficialCache } from './aqi'
import { clearRateLimits } from './_lib/rateLimit'

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
  reason?: string | null
  aqi?: number | null
  station?: string | null
  distanceKm?: number | null
  observedAt?: string | null
  provider?: string
  pollutants?: { id: string; label: string; value: number; min: number | null; max: number | null; unit: string }[]
}

beforeEach(() => {
  clearRateLimits()
  clearOfficialCache()
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

  it('surfaces official station concentrations without inventing an AQI', async () => {
    process.env.DATA_GOV_IN_API_KEY = 'test-key'
    process.env.DATA_GOV_IN_RESOURCE_ID = 'test-resource'
    const row = (pollutant: string, min: string, max: string, avg: string) => ({
      city: 'Delhi',
      station: 'Anand Vihar, Delhi - DPCC',
      last_update: '18-11-2026 14:00:00',
      pollutant_id: pollutant,
      min_value: min,
      max_value: max,
      avg_value: avg,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        providerResponse([
          row('PM2.5', '180', '240', '210'),
          row('PM10', '300', '420', '351'),
          row('NO2', '60', '90', '74'),
          row('CO', '2', '4', '3'),
          // A station reporting placeholder dashes must not become a reading.
          row('-', '-', '-', '-'),
        ]),
      ),
    )

    const data = (await (await handler(request('Delhi', '10.2.0.10'))).json()) as OfficialResponse
    expect(data.available).toBe(true)
    expect(data.aqi).toBeNull()
    expect(data.station).toContain('Anand Vihar')
    expect(data.observedAt).toContain('18-11-2026')
    expect(data.provider).toContain('official')

    const pollutants = data.pollutants ?? []
    expect(pollutants.map(item => item.id)).toEqual(['PM25', 'PM10', 'NO2', 'CO'])
    const pm25 = pollutants[0]!
    expect(pm25.value).toBe(210)
    expect(pm25.min).toBe(180)
    expect(pm25.max).toBe(240)
    expect(pm25.unit).toBe('µg/m³')
    expect(pollutants.find(item => item.id === 'CO')?.unit).toBe('as published')
  })

  it('groups rows by station and picks the most complete station', async () => {
    process.env.DATA_GOV_IN_API_KEY = 'test-key'
    process.env.DATA_GOV_IN_RESOURCE_ID = 'test-resource'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        providerResponse([
          { city: 'Pune', station: 'Shivajinagar, Pune - MPCB', pollutant_id: 'PM2.5', avg_value: '88' },
          { city: 'Pune', station: 'Shivajinagar, Pune - MPCB', pollutant_id: 'PM10', avg_value: '140' },
          { city: 'Pune', station: 'Hadapsar, Pune - MPCB', pollutant_id: 'NO2', avg_value: '35' },
        ]),
      ),
    )

    const data = (await (await handler(request('Pune', '10.2.0.11'))).json()) as OfficialResponse
    expect(data.station).toBe('Shivajinagar, Pune - MPCB')
    expect(data.pollutants).toHaveLength(2)
    expect(data.pollutants?.map(item => item.id)).toEqual(['PM25', 'PM10'])
  })

  it('retries with the trailing place name when the exact city has no rows', async () => {
    process.env.DATA_GOV_IN_API_KEY = 'test-key'
    process.env.DATA_GOV_IN_RESOURCE_ID = 'test-resource'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(providerResponse([]))
      .mockResolvedValueOnce(
        providerResponse([
          { city: 'Delhi', station: 'Anand Vihar, Delhi - DPCC', pollutant_id: 'PM2.5', avg_value: '210' },
        ]),
      )
    vi.stubGlobal('fetch', fetchMock)

    const data = (await (await handler(request('New Delhi', '10.2.0.12'))).json()) as OfficialResponse
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('New+Delhi')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('city%5D=Delhi')
    expect(data.available).toBe(true)
    expect(data.aqi).toBeNull()
  })

  it('explains provider rate limiting instead of showing a number', async () => {
    process.env.DATA_GOV_IN_API_KEY = 'test-key'
    process.env.DATA_GOV_IN_RESOURCE_ID = 'test-resource'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const data = (await (await handler(request('Delhi', '10.2.0.13'))).json()) as OfficialResponse
    expect(data.available).toBe(false)
    expect(data.reason).toContain('rate-limiting')
    expect(data.aqi).toBeNull()
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

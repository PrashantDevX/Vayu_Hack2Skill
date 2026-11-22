import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildHourly, clearAirQualityCache, fetchAirQuality } from './aqiService'
import type { LocationState } from '../types'

const location: LocationState = {
  city: 'New Delhi',
  latitude: 28.6139,
  longitude: 77.209,
  label: 'search',
}

const airPayload = {
  current: {
    time: '2026-11-18T10:30',
    pm2_5: 90,
    pm10: 100,
    nitrogen_dioxide: 40,
    sulphur_dioxide: 20,
    carbon_monoxide: 700,
    ozone: 30,
    ammonia: 50,
  },
  hourly: {
    time: Array.from({ length: 14 }, (_, index) => `2026-11-18T${String(index).padStart(2, '0')}:00`),
    pm2_5: Array.from({ length: 14 }, (_, index) => 40 + index * 5),
    pm10: Array.from({ length: 14 }, () => 100),
    nitrogen_dioxide: Array.from({ length: 14 }, () => 40),
    sulphur_dioxide: Array.from({ length: 14 }, () => 20),
    carbon_monoxide: Array.from({ length: 14 }, () => 700),
    ozone: Array.from({ length: 14 }, () => 30),
    ammonia: Array.from({ length: 14 }, () => 50),
  },
}

const weatherPayload = {
  current: {
    time: '2026-11-18T10:30',
    temperature_2m: 24.4,
    relative_humidity_2m: 55,
    wind_speed_10m: 8,
    weather_code: 2,
  },
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function mockProviders(official: unknown = { available: false, reason: 'Not configured' }) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('air-quality-api.open-meteo.com')) return jsonResponse(airPayload)
    if (url.includes('/v1/forecast')) return jsonResponse(weatherPayload)
    if (url.includes('/api/aqi')) return jsonResponse(official)
    return jsonResponse({}, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  clearAirQualityCache()
  vi.unstubAllGlobals()
})

describe('Open-Meteo model adapter', () => {
  it('normalizes pollutants, converts CO to mg/m³ and computes an estimate', async () => {
    mockProviders()
    const result = await fetchAirQuality(location)
    expect(result.model.provider).toContain('Open-Meteo')
    expect(result.model.assessment.aqi).toBe(200)
    expect(result.model.assessment.validPollutants).toBe(7)
    const co = result.model.assessment.pollutants.find(item => item.key === 'co')
    expect(co?.value).toBeCloseTo(0.7)
    expect(result.model.averagingNote).toContain('not official')
  })

  it('starts the hourly series at the current hour and labels local time', async () => {
    mockProviders()
    const result = await fetchAirQuality(location)
    expect(result.model.hourly.length).toBe(4)
    expect(result.model.hourly[0]?.label).toBe('10:00')
    expect(result.model.hourly[0]?.time).toBe('2026-11-18T10:00')
    expect(result.model.hourly[0]?.pm25).toBe(90)
    expect(result.model.hourly[0]?.aqi).toBe(200)
  })

  it('keeps weather non-blocking when that provider fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('air-quality-api')) return jsonResponse(airPayload)
        if (url.includes('/v1/forecast')) return jsonResponse({ error: true }, 500)
        return jsonResponse({ available: false }, 200)
      }),
    )
    const result = await fetchAirQuality(location)
    expect(result.weather).toBeNull()
    expect(result.model.assessment.aqi).toBe(200)
  })

  it('leaves missing humidity and wind null rather than inventing zero', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('air-quality-api')) return jsonResponse(airPayload)
        if (url.includes('/v1/forecast')) {
          return jsonResponse({
            current: { time: '2026-11-18T10:30', temperature_2m: 24.4, weather_code: 2 },
          })
        }
        return jsonResponse({ available: false }, 200)
      }),
    )

    const result = await fetchAirQuality(location)
    expect(result.weather?.temperatureC).toBeCloseTo(24.4)
    expect(result.weather?.humidityPct).toBeNull()
    expect(result.weather?.windKmh).toBeNull()
  })

  it('marks official data unavailable instead of mixing it with the model', async () => {
    mockProviders({ available: false, reason: 'Official provider is not configured.' })
    const result = await fetchAirQuality(location)
    expect(result.official.available).toBe(false)
    expect(result.official.aqi).toBeNull()
    expect(result.official.reason).toContain('not configured')
  })

  it('accepts an official reading separately from the model estimate', async () => {
    mockProviders({ available: true, aqi: 312, station: 'Anand Vihar', observedAt: '2026-11-18T10:00', provider: 'CPCB' })
    const result = await fetchAirQuality(location)
    expect(result.official.available).toBe(true)
    expect(result.official.aqi).toBe(312)
    expect(result.official.category).toBe('Very Poor')
    expect(result.model.assessment.aqi).toBe(200)
  })

  it('caches model data by rounded coordinate but refreshes on force', async () => {
    const fetchMock = mockProviders()
    await fetchAirQuality(location)
    const airCalls = fetchMock.mock.calls.filter(call => String(call[0]).includes('air-quality-api')).length
    await fetchAirQuality({ ...location, latitude: 28.6141, longitude: 77.2092 })
    expect(fetchMock.mock.calls.filter(call => String(call[0]).includes('air-quality-api')).length).toBe(airCalls)
    await fetchAirQuality(location, { force: true })
    expect(fetchMock.mock.calls.filter(call => String(call[0]).includes('air-quality-api')).length).toBe(airCalls + 1)
  })

  it('throws when the model provider is unavailable or malformed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: true }, 503)))
    await expect(fetchAirQuality(location)).rejects.toThrow()

    clearAirQualityCache()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('air-quality-api')) return jsonResponse({ current: 'bad' })
        return jsonResponse(weatherPayload)
      }),
    )
    await expect(fetchAirQuality(location)).rejects.toThrow('unexpected payload')
  })
})

describe('hourly builder', () => {
  it('returns unavailable AQI when hourly coverage is insufficient', () => {
    const points = buildHourly(
      {
        time: ['2026-11-18T10:00', '2026-11-18T11:00'],
        pm2_5: [45, 50],
        pm10: [null, null],
        nitrogen_dioxide: [null, null],
        sulphur_dioxide: [null, null],
        carbon_monoxide: [null, null],
        ozone: [null, null],
        ammonia: [null, null],
      },
      '2026-11-18T10:15',
    )
    expect(points).toHaveLength(2)
    expect(points[0]?.pm25).toBe(45)
    expect(points[0]?.aqi).toBeNull()
    expect(points[0]?.category).toBeNull()
  })
})

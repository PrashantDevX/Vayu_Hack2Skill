import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchOfficialAqi } from './officialService'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function stub(body: unknown, status = 200) {
  const mock = vi.fn().mockResolvedValue(jsonResponse(body, status))
  vi.stubGlobal('fetch', mock)
  return mock
}

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => vi.unstubAllGlobals())

describe('official AQI client', () => {
  it('accepts official station concentrations without inventing an AQI', async () => {
    const mock = stub({
      available: true,
      aqi: null,
      station: 'Anand Vihar, Delhi - DPCC',
      observedAt: '18-11-2026 14:00:00',
      provider: 'data.gov.in CPCB CAAQMS station data (official observation)',
      pollutants: [
        { id: 'PM25', label: 'PM2.5', value: 210, min: 180, max: 240, unit: 'µg/m³' },
        { id: 'CO', label: 'CO', value: 3, min: null, max: null, unit: 'as published' },
      ],
    })

    const result = await fetchOfficialAqi('New Delhi')
    expect(result.available).toBe(true)
    expect(result.aqi).toBeNull()
    expect(result.category).toBeNull()
    expect(result.station).toContain('Anand Vihar')
    expect(result.pollutants).toHaveLength(2)
    expect(result.pollutants[1]).toEqual({ id: 'CO', label: 'CO', value: 3, min: null, max: null, unit: 'as published' })
    expect(String(mock.mock.calls[0]?.[0])).toContain('/api/aqi?city=New%20Delhi')
  })

  it('classifies a published AQI and keeps any concentrations that came with it', async () => {
    stub({
      available: true,
      aqi: 312,
      station: 'Anand Vihar',
      pollutants: [{ id: 'PM25', label: 'PM2.5', value: 210, min: 180, max: 240, unit: 'µg/m³' }],
    })

    const result = await fetchOfficialAqi('Delhi')
    expect(result.aqi).toBe(312)
    expect(result.category).toBe('Very Poor')
    expect(result.pollutants).toHaveLength(1)
  })

  it('rejects an out-of-scale AQI instead of clamping it', async () => {
    stub({ available: true, aqi: 812 })
    const result = await fetchOfficialAqi('Delhi')
    expect(result.available).toBe(false)
    expect(result.aqi).toBeNull()
    expect(result.reason).toContain('outside the CPCB scale')
  })

  it('rejects malformed pollutant values and falls back to unavailable', async () => {
    stub({
      available: true,
      aqi: null,
      pollutants: [{ id: 'PM25', label: 'PM2.5', value: -5, unit: 'µg/m³' }],
    })
    const result = await fetchOfficialAqi('Delhi')
    expect(result.available).toBe(false)
    expect(result.pollutants).toEqual([])
  })

  it('passes through the provider reason when nothing is available', async () => {
    stub({ available: false, reason: 'The official provider is rate-limiting this API key.' })
    const result = await fetchOfficialAqi('Delhi')
    expect(result.available).toBe(false)
    expect(result.reason).toContain('rate-limiting')
    expect(result.pollutants).toEqual([])
  })

  it('explains the Vite dev-server case and network failures', async () => {
    stub({ error: 'not found' }, 404)
    expect((await fetchOfficialAqi('Delhi')).reason).toContain('Vite dev server')

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const failed = await fetchOfficialAqi('Delhi')
    expect(failed.available).toBe(false)
    expect(failed.reason).toContain('temporarily unavailable')
  })
})

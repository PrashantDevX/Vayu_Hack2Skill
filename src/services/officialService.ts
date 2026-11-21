import { z } from 'zod'
import type { OfficialPollutant, OfficialSnapshot } from '../types'
import { categoryFromAqi } from '../utils/aqi'
import { fetchJson } from './http'

const officialPollutantSchema = z.object({
  id: z.string().min(1).max(16),
  label: z.string().min(1).max(16),
  value: z.number().finite().min(0).max(100_000),
  min: z.number().finite().min(0).max(100_000).nullable().optional(),
  max: z.number().finite().min(0).max(100_000).nullable().optional(),
  unit: z.string().min(1).max(16),
})

const officialResponseSchema = z.object({
  available: z.boolean(),
  aqi: z.number().nullable().optional(),
  station: z.string().nullable().optional(),
  distanceKm: z.number().nullable().optional(),
  observedAt: z.string().nullable().optional(),
  provider: z.string().optional(),
  reason: z.string().nullable().optional(),
  pollutants: z.array(officialPollutantSchema).max(12).optional(),
})

const UNAVAILABLE_PROVIDER = 'data.gov.in / CPCB-linked resource'

function mapPollutants(raw: z.infer<typeof officialPollutantSchema>[] | undefined): OfficialPollutant[] {
  if (!raw) return []
  return raw.map(item => ({
    id: item.id,
    label: item.label,
    value: item.value,
    min: item.min ?? null,
    max: item.max ?? null,
    unit: item.unit,
  }))
}

export async function fetchOfficialAqi(city: string): Promise<OfficialSnapshot> {
  const unavailable = (reason: string): OfficialSnapshot => ({
    available: false,
    aqi: null,
    category: null,
    station: null,
    distanceKm: null,
    observedAt: null,
    provider: UNAVAILABLE_PROVIDER,
    reason,
    pollutants: [],
  })

  try {
    const raw = await fetchJson(`/api/aqi?city=${encodeURIComponent(city)}`, {
      timeoutMs: 6_000,
      retries: 0,
    })
    const parsed = officialResponseSchema.safeParse(raw)
    if (!parsed.success) return unavailable('Official provider returned an unexpected response.')

    if (!parsed.data.available) {
      return unavailable(parsed.data.reason ?? 'No official observation is available for this city.')
    }

    const pollutants = mapPollutants(parsed.data.pollutants)
    const station = parsed.data.station ?? null
    const distanceKm = parsed.data.distanceKm ?? null
    const observedAt = parsed.data.observedAt ?? null
    const provider = parsed.data.provider ?? UNAVAILABLE_PROVIDER

    if (parsed.data.aqi === null || parsed.data.aqi === undefined) {
      // Pollutant-only resources are legitimate official observations, but they
      // never yield an "official AQI" here.
      if (pollutants.length === 0) {
        return unavailable(parsed.data.reason ?? 'No official observation is available for this city.')
      }
      return {
        available: true,
        aqi: null,
        category: null,
        station,
        distanceKm,
        observedAt,
        provider,
        reason: null,
        pollutants,
      }
    }

    const aqi = Math.round(parsed.data.aqi)
    if (!Number.isFinite(aqi) || aqi < 0 || aqi > 500) {
      return unavailable('Official provider returned an AQI outside the CPCB scale.')
    }

    return {
      available: true,
      aqi,
      category: categoryFromAqi(aqi),
      station,
      distanceKm,
      observedAt,
      provider,
      reason: null,
      pollutants,
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('status 404')) {
      return unavailable('Official provider endpoint is not available in this environment (Vite dev server).')
    }
    return unavailable('Official provider is temporarily unavailable.')
  }
}

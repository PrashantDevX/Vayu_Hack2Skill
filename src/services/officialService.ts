import { z } from 'zod'
import type { OfficialSnapshot } from '../types'
import { categoryFromAqi } from '../utils/aqi'
import { fetchJson } from './http'

const officialResponseSchema = z.object({
  available: z.boolean(),
  aqi: z.number().nullable().optional(),
  station: z.string().nullable().optional(),
  distanceKm: z.number().nullable().optional(),
  observedAt: z.string().nullable().optional(),
  provider: z.string().optional(),
  reason: z.string().nullable().optional(),
})

const UNAVAILABLE_PROVIDER = 'data.gov.in / CPCB-linked resource'

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
  })

  try {
    const raw = await fetchJson<unknown>(`/api/aqi?city=${encodeURIComponent(city)}`, {
      timeoutMs: 6_000,
      retries: 0,
    })
    const parsed = officialResponseSchema.safeParse(raw)
    if (!parsed.success) return unavailable('Official provider returned an unexpected response.')

    if (!parsed.data.available || parsed.data.aqi === null || parsed.data.aqi === undefined) {
      return unavailable(parsed.data.reason ?? 'No official observation is available for this city.')
    }

    const aqi = Math.round(parsed.data.aqi)
    if (!Number.isFinite(aqi) || aqi < 0 || aqi > 500) {
      return unavailable('Official provider returned an AQI outside the CPCB scale.')
    }

    return {
      available: true,
      aqi,
      category: categoryFromAqi(aqi),
      station: parsed.data.station ?? null,
      distanceKm: parsed.data.distanceKm ?? null,
      observedAt: parsed.data.observedAt ?? null,
      provider: parsed.data.provider ?? UNAVAILABLE_PROVIDER,
      reason: null,
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('status 404')) {
      return unavailable('Official provider endpoint is not available in this environment (Vite dev server).')
    }
    return unavailable('Official provider is temporarily unavailable.')
  }
}

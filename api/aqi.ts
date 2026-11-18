import { z } from 'zod'
import { checkRateLimit, clientKey } from './lib/rateLimit.js'

export const config = { runtime: 'nodejs', maxDuration: 15 }

const providerSchema = z.object({
  records: z.array(z.record(z.string(), z.unknown())).optional(),
})

interface OfficialResult {
  available: boolean
  aqi: number | null
  station: string | null
  distanceKm: number | null
  observedAt: string | null
  provider: string
  reason: string | null
}

interface CacheEntry {
  expiresAt: number
  value: OfficialResult
}

const cache = new Map<string, CacheEntry>()
const AVAILABLE_TTL_MS = 10 * 60 * 1000
const UNAVAILABLE_TTL_MS = 3 * 60 * 1000

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function pick(record: Record<string, unknown>, candidates: string[]): unknown {
  const wanted = new Set(candidates.map(normalizeKey))
  for (const [key, value] of Object.entries(record)) {
    if (wanted.has(normalizeKey(key)) && value !== null && value !== undefined && value !== '') return value
  }
  return null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 200)
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function unavailable(reason: string): OfficialResult {
  return {
    available: false,
    aqi: null,
    station: null,
    distanceKm: null,
    observedAt: null,
    provider: 'data.gov.in CPCB-linked resource',
    reason,
  }
}

function normalize(records: Record<string, unknown>[], city: string): OfficialResult {
  if (records.length === 0) return unavailable(`No official records were returned for ${city}.`)

  const normalizedCity = city.toLowerCase()
  const matching = records.filter(record => {
    const value = asText(pick(record, ['city', 'cityname', 'location', 'state', 'station', 'stationname']))
    return value === null || value.toLowerCase().includes(normalizedCity)
  })
  const candidates = matching.length > 0 ? matching : records

  for (const record of candidates) {
    const aqiValue = asNumber(
      pick(record, ['aqi', 'airqualityindex', 'overallaqi', 'aqivalue', 'aqi_value']),
    )
    if (aqiValue === null) continue
    const aqi = Math.round(aqiValue)
    if (aqi < 0 || aqi > 500) continue
    const rawDistance = asNumber(
      pick(record, ['distance', 'distancekm', 'distancefromstation', 'stationdistance']),
    )
    return {
      available: true,
      aqi,
      station: asText(pick(record, ['station', 'stationname', 'monitoringstation', 'sitename', 'location'])),
      distanceKm:
        rawDistance !== null && rawDistance >= 0 && rawDistance <= 500
          ? Math.round(rawDistance * 10) / 10
          : null,
      observedAt: asText(pick(record, ['lastupdate', 'date', 'timestamp', 'updatedat', 'observationtime', 'samplingdate'])),
      provider: 'data.gov.in CPCB-linked resource (official observation)',
      reason: null,
    }
  }

  return unavailable(
    'The configured resource responded, but no record contained a usable AQI value. Pollutant-only records are not converted into an official AQI.',
  )
}

async function fetchOfficial(city: string, resourceId: string, apiKey: string): Promise<OfficialResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const params = new URLSearchParams({
      'api-key': apiKey,
      format: 'json',
      limit: '100',
      'filters[city]': city,
    })
    const response = await fetch(`https://api.data.gov.in/resource/${encodeURIComponent(resourceId)}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) return unavailable('The official provider returned an error.')
    const raw: unknown = await response.json()
    const parsed = providerSchema.safeParse(raw)
    if (!parsed.success || !parsed.data.records) {
      return unavailable('The official provider returned an unexpected response shape.')
    }
    return normalize(parsed.data.records, city)
  } catch {
    return unavailable('The official provider is temporarily unavailable.')
  } finally {
    clearTimeout(timeout)
  }
}

export default async function handler(req: Request): Promise<Response> {
  const limit = checkRateLimit(`aqi:${clientKey(req)}`, 60)
  if (!limit.allowed) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET' } })
  }

  const city = new URL(req.url).searchParams.get('city')?.trim().slice(0, 80)
  if (!city) return Response.json(unavailable('A city is required.'), { status: 400 })

  const cached = cache.get(city)
  if (cached && cached.expiresAt > Date.now()) {
    return Response.json(cached.value, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' },
    })
  }

  const apiKey = process.env.DATA_GOV_IN_API_KEY
  const resourceId = process.env.DATA_GOV_IN_RESOURCE_ID
  let result: OfficialResult
  if (!apiKey || !resourceId) {
    result = unavailable('Official CPCB provider is not configured on this deployment.')
  } else {
    result = await fetchOfficial(city, resourceId, apiKey)
  }

  cache.set(city, {
    expiresAt: Date.now() + (result.available ? AVAILABLE_TTL_MS : UNAVAILABLE_TTL_MS),
    value: result,
  })

  return Response.json(result, {
    headers: { 'Cache-Control': result.available ? 'public, s-maxage=600, stale-while-revalidate=300' : 'no-store' },
  })
}

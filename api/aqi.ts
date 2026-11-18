import { z } from 'zod'
import { checkRateLimit, clientKey } from './lib/rateLimit.js'

export const config = { runtime: 'nodejs', maxDuration: 15 }

const providerSchema = z.object({
  records: z.array(z.record(z.string(), z.unknown())).optional(),
})

export interface OfficialPollutant {
  /** Canonical key: PM25, PM10, NO2, SO2, CO, O3, NH3. */
  id: string
  label: string
  value: number
  min: number | null
  max: number | null
  unit: string
}

interface OfficialResult {
  available: boolean
  aqi: number | null
  station: string | null
  distanceKm: number | null
  observedAt: string | null
  provider: string
  reason: string | null
  /**
   * Official station concentrations, used when the resource publishes pollutants
   * but no AQI field (the CPCB real-time dataset behaves this way).
   */
  pollutants: OfficialPollutant[]
}

/** Display order and CPCB reporting units. CO is reported in mg/m³. */
const POLLUTANT_META: Record<string, { label: string; unit: string; rank: number }> = {
  PM25: { label: 'PM2.5', unit: 'µg/m³', rank: 0 },
  PM10: { label: 'PM10', unit: 'µg/m³', rank: 1 },
  NO2: { label: 'NO₂', unit: 'µg/m³', rank: 2 },
  SO2: { label: 'SO₂', unit: 'µg/m³', rank: 3 },
  CO: { label: 'CO', unit: 'as published', rank: 4 },
  O3: { label: 'O₃', unit: 'µg/m³', rank: 5 },
  NH3: { label: 'NH₃', unit: 'µg/m³', rank: 6 },
}

interface CacheEntry {
  expiresAt: number
  value: OfficialResult
}

const cache = new Map<string, CacheEntry>()
const AVAILABLE_TTL_MS = 10 * 60 * 1000
const UNAVAILABLE_TTL_MS = 3 * 60 * 1000

/** Test-only: drop cached provider responses so cases stay independent. */
export function clearOfficialCache(): void {
  cache.clear()
}

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

/** Normalises provider pollutant codes: PM2.5, ozone, NO2, etc. */
function pollutantKey(raw: unknown): string | null {
  const text = asText(raw)
  if (!text) return null
  const key = text.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (key === 'PM25' || key === 'PM2P5') return 'PM25'
  if (key === 'PM10') return 'PM10'
  if (key === 'NO2') return 'NO2'
  if (key === 'SO2') return 'SO2'
  if (key === 'CO') return 'CO'
  if (key === 'O3' || key === 'OZONE') return 'O3'
  if (key === 'NH3') return 'NH3'
  return null
}

function boundedNumber(value: unknown): number | null {
  const parsed = asNumber(value)
  if (parsed === null || parsed < 0 || parsed > 100_000) return null
  return parsed
}

interface StationSummary {
  station: string
  observedAt: string | null
  pollutants: OfficialPollutant[]
}

/**
 * Groups pollutant-only rows by station. The CPCB real-time resource publishes
 * one row per pollutant per station, so a station is the only valid grouping.
 */
function collectStations(records: Record<string, unknown>[]): StationSummary[] {
  const groups = new Map<
    string,
    { station: string; observedAt: string | null; values: Map<string, OfficialPollutant> }
  >()

  for (const record of records) {
    const key = pollutantKey(pick(record, ['pollutantid', 'pollutant', 'pollutantname']))
    if (!key) continue
    const value = boundedNumber(pick(record, ['avgvalue', 'pollutantavg', 'avg', 'value', 'pollutantvalue']))
    if (value === null) continue

    const station =
      asText(pick(record, ['station', 'stationname', 'sitename', 'location'])) ?? 'Unnamed station'
    const observedAt = asText(pick(record, ['lastupdate', 'updatedat', 'timestamp', 'date']))
    const group = groups.get(station) ?? { station, observedAt: null, values: new Map() }
    group.observedAt = group.observedAt ?? observedAt

    if (!group.values.has(key)) {
      const meta = POLLUTANT_META[key]
      if (meta) {
        group.values.set(key, {
          id: key,
          label: meta.label,
          value,
          min: boundedNumber(pick(record, ['minvalue', 'pollutantmin'])),
          max: boundedNumber(pick(record, ['maxvalue', 'pollutantmax'])),
          unit: meta.unit,
        })
      }
    }
    groups.set(station, group)
  }

  return [...groups.values()]
    .map(group => ({
      station: group.station,
      observedAt: group.observedAt,
      pollutants: [...group.values.values()].sort(
        (a, b) => (POLLUTANT_META[a.id]?.rank ?? 99) - (POLLUTANT_META[b.id]?.rank ?? 99),
      ),
    }))
    .filter(group => group.pollutants.length > 0)
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
    pollutants: [],
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
      pollutants: [],
    }
  }

  // The CPCB real-time resource publishes one row per pollutant per station and
  // no AQI field. Surface those official concentrations as observations; never
  // derive an "official AQI" from them.
  const stations = collectStations(candidates)
  if (stations.length > 0) {
    const best = [...stations].sort((a, b) => {
      const aMatch = a.station.toLowerCase().includes(normalizedCity) ? 1 : 0
      const bMatch = b.station.toLowerCase().includes(normalizedCity) ? 1 : 0
      return bMatch - aMatch || b.pollutants.length - a.pollutants.length
    })[0]

    if (best) {
      return {
        available: true,
        aqi: null,
        station: best.station,
        distanceKm: null,
        observedAt: best.observedAt,
        provider: 'data.gov.in CPCB CAAQMS station data (official observation)',
        reason: null,
        pollutants: best.pollutants,
      }
    }
  }

  return unavailable(
    'The configured resource responded, but no record contained a usable AQI or pollutant value.',
  )
}

async function queryResource(
  city: string,
  resourceId: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<{ records: Record<string, unknown>[] } | { failure: string }> {
  const params = new URLSearchParams({
    'api-key': apiKey,
    format: 'json',
    limit: '100',
    'filters[city]': city,
  })
  const response = await fetch(
    `https://api.data.gov.in/resource/${encodeURIComponent(resourceId)}?${params.toString()}`,
    { headers: { Accept: 'application/json' }, signal },
  )
  if (response.status === 429) {
    return { failure: 'The official provider is rate-limiting this API key. Try again in a minute.' }
  }
  if (!response.ok) return { failure: 'The official provider returned an error.' }
  const raw: unknown = await response.json()
  const parsed = providerSchema.safeParse(raw)
  if (!parsed.success || !parsed.data.records) {
    return { failure: 'The official provider returned an unexpected response shape.' }
  }
  return { records: parsed.data.records }
}

async function fetchOfficial(city: string, resourceId: string, apiKey: string): Promise<OfficialResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const primary = await queryResource(city, resourceId, apiKey, controller.signal)
    if ('failure' in primary) return unavailable(primary.failure)
    if (primary.records.length > 0) return normalize(primary.records, city)

    // Geocoding returns "New Delhi" and "Navi Mumbai", but the dataset stores
    // "Delhi" and "Mumbai". Retry once with the trailing place name.
    const words = city.split(/\s+/).filter(Boolean)
    const simpler = words.length > 1 ? words[words.length - 1] : null
    if (simpler && simpler.toLowerCase() !== city.toLowerCase()) {
      const secondary = await queryResource(simpler, resourceId, apiKey, controller.signal)
      if ('failure' in secondary) return unavailable(secondary.failure)
      if (secondary.records.length > 0) return normalize(secondary.records, city)
    }

    return normalize([], city)
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

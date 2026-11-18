import { z } from 'zod'
import type { Place } from '../types'
import { cacheGet, cacheSet } from './cache'
import { fetchJson } from './http'

const geocodingSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        admin1: z.string().nullable().optional(),
        country: z.string().nullable().optional(),
      }),
    )
    .optional(),
})

const SEARCH_TTL_MS = 60 * 60 * 1000

export async function searchCities(query: string, limit = 5): Promise<Place[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  const key = `geo:${trimmed.toLowerCase()}:${limit}`
  const cached = cacheGet<Place[]>(key)
  if (cached) return cached.value

  const url =
    'https://geocoding-api.open-meteo.com/v1/search' +
    `?name=${encodeURIComponent(trimmed)}&count=${limit}&language=en&format=json`
  const raw = await fetchJson<unknown>(url, { timeoutMs: 7_000, retries: 1 })
  const parsed = geocodingSchema.safeParse(raw)
  if (!parsed.success) throw new Error('Geocoding provider returned an unexpected response')

  const places: Place[] = (parsed.data.results ?? []).map(result => ({
    name: result.name,
    admin1: result.admin1 ?? null,
    country: result.country ?? null,
    latitude: result.latitude,
    longitude: result.longitude,
  }))
  cacheSet(key, places, SEARCH_TTL_MS)
  return places
}

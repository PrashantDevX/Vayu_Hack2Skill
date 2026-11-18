import { z } from 'zod'
import { assessAqi } from '../utils/aqi'
import { formatHourLabel } from '../utils/date'
import type {
  AirQualitySnapshot,
  HourlyPoint,
  LocationState,
  ModelSnapshot,
  PollutantValues,
  WeatherNow,
} from '../types'
import { cacheGet, cacheSet, coordinateKey } from './cache'
import { fetchJson } from './http'
import { fetchOfficialAqi } from './officialService'

const numberOrNull = z.number().nullable().optional()

const airResponseSchema = z.object({
  current: z
    .object({
      time: z.string().optional(),
      pm2_5: numberOrNull,
      pm10: numberOrNull,
      nitrogen_dioxide: numberOrNull,
      sulphur_dioxide: numberOrNull,
      carbon_monoxide: numberOrNull,
      ozone: numberOrNull,
      ammonia: numberOrNull,
    })
    .passthrough(),
  hourly: z
    .object({
      time: z.array(z.string()),
      pm2_5: z.array(numberOrNull).optional(),
      pm10: z.array(numberOrNull).optional(),
      nitrogen_dioxide: z.array(numberOrNull).optional(),
      sulphur_dioxide: z.array(numberOrNull).optional(),
      carbon_monoxide: z.array(numberOrNull).optional(),
      ozone: z.array(numberOrNull).optional(),
      ammonia: z.array(numberOrNull).optional(),
    })
    .passthrough(),
})

const weatherResponseSchema = z.object({
  current: z
    .object({
      time: z.string().optional(),
      temperature_2m: numberOrNull,
      relative_humidity_2m: numberOrNull,
      wind_speed_10m: numberOrNull,
      weather_code: numberOrNull,
    })
    .passthrough(),
})

const AIR_FIELDS = [
  'pm2_5',
  'pm10',
  'nitrogen_dioxide',
  'sulphur_dioxide',
  'carbon_monoxide',
  'ozone',
  'ammonia',
] as const

type AirField = (typeof AIR_FIELDS)[number]

const PROVIDER = 'Open-Meteo Air Quality (CAMS model)'
const AVERAGING_NOTE =
  'CPCB-style sub-indices are computed from instantaneous CAMS model concentrations, not official 24-hour/8-hour averages or CPCB station observations.'

function clean(value: number | null | undefined): number | null {
  return value === null || value === undefined || !Number.isFinite(value) || value < 0 ? null : value
}

function valuesFromCurrent(current: z.infer<typeof airResponseSchema>['current']): PollutantValues {
  const co = clean(current.carbon_monoxide)
  return {
    pm25: clean(current.pm2_5),
    pm10: clean(current.pm10),
    no2: clean(current.nitrogen_dioxide),
    so2: clean(current.sulphur_dioxide),
    co: co === null ? null : co / 1000,
    o3: clean(current.ozone),
    nh3: clean(current.ammonia),
  }
}

function valuesFromHourly(
  hourly: z.infer<typeof airResponseSchema>['hourly'],
  index: number,
): PollutantValues {
  const read = (field: AirField): number | null => {
    const array = hourly[field]
    return clean(array?.[index] ?? null)
  }
  const co = read('carbon_monoxide')
  return {
    pm25: read('pm2_5'),
    pm10: read('pm10'),
    no2: read('nitrogen_dioxide'),
    so2: read('sulphur_dioxide'),
    co: co === null ? null : co / 1000,
    o3: read('ozone'),
    nh3: read('ammonia'),
  }
}

function startIndexFor(hourlyTimes: string[], currentTime: string | undefined): number {
  if (!currentTime) return 0
  const currentHour = currentTime.slice(0, 13)
  let start = 0
  for (let index = 0; index < hourlyTimes.length; index += 1) {
    const time = hourlyTimes[index]
    if (time === undefined) break
    if (time.slice(0, 13) <= currentHour) start = index
    else break
  }
  return start
}

function buildHourly(
  hourly: z.infer<typeof airResponseSchema>['hourly'],
  currentTime: string | undefined,
): HourlyPoint[] {
  const start = startIndexFor(hourly.time, currentTime)
  const points: HourlyPoint[] = []

  for (let index = start; index < hourly.time.length && points.length < 24; index += 1) {
    const time = hourly.time[index]
    if (!time) continue
    const values = valuesFromHourly(hourly, index)
    const assessment = assessAqi(values)
    points.push({
      time,
      label: formatHourLabel(time),
      pm25: values.pm25,
      aqi: assessment.aqi,
      category: assessment.category,
    })
  }

  return points
}

const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm with hail',
}

function describeWeather(code: number | null): string {
  if (code === null) return 'Conditions unavailable'
  return WEATHER_DESCRIPTIONS[code] ?? 'Weather conditions'
}

async function fetchWeather(latitude: number, longitude: number): Promise<WeatherNow | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto'
  try {
    const raw = await fetchJson<unknown>(url, { timeoutMs: 8_000, retries: 1 })
    const parsed = weatherResponseSchema.safeParse(raw)
    if (!parsed.success) return null
    const current = parsed.data.current
    const temperature = clean(current.temperature_2m)
    const humidity = clean(current.relative_humidity_2m)
    const wind = clean(current.wind_speed_10m)
    const code = clean(current.weather_code)
    if (temperature === null) return null
    return {
      temperatureC: temperature,
      // Missing weather fields stay null so the UI can say "Unavailable"
      // instead of showing a fabricated 0%.
      humidityPct: humidity,
      windKmh: wind,
      weatherCode: code,
      description: describeWeather(code),
      observedAt: current.time ?? null,
    }
  } catch {
    return null
  }
}

async function fetchModel(
  latitude: number,
  longitude: number,
): Promise<{ model: ModelSnapshot; weather: WeatherNow | null }> {
  const params = AIR_FIELDS.join(',')
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}` +
    `&current=${params}&hourly=${params}&forecast_days=2&timezone=auto`

  const [airResult, weather] = await Promise.all([
    fetchJson<unknown>(url, { timeoutMs: 9_000, retries: 1 }),
    fetchWeather(latitude, longitude),
  ])

  const parsed = airResponseSchema.safeParse(airResult)
  if (!parsed.success) throw new Error('Air-quality provider returned an unexpected payload')

  const current = parsed.data.current
  const values = valuesFromCurrent(current)
  const assessment = assessAqi(values, 'model')

  return {
    model: {
      assessment,
      hourly: buildHourly(parsed.data.hourly, current.time),
      provider: PROVIDER,
      model: 'CAMS global atmospheric composition forecast',
      fetchedAt: new Date().toISOString(),
      averagingNote: AVERAGING_NOTE,
    },
    weather,
  }
}

interface CachedAir {
  model: ModelSnapshot
  weather: WeatherNow | null
}

const AIR_CACHE_TTL_MS = 10 * 60 * 1000

export async function fetchAirQuality(
  location: LocationState,
  options: { force?: boolean } = {},
): Promise<AirQualitySnapshot> {
  const key = `air:${coordinateKey(location.latitude, location.longitude)}`
  const cached = options.force ? null : cacheGet<CachedAir>(key)
  let cachedAir = cached?.value ?? null
  let fetchedAt = cached ? new Date(cached.fetchedAt).toISOString() : null

  if (!cachedAir) {
    cachedAir = await fetchModel(location.latitude, location.longitude)
    const entry = cacheSet(key, cachedAir, AIR_CACHE_TTL_MS)
    fetchedAt = new Date(entry.fetchedAt).toISOString()
  }

  const official = await fetchOfficialAqi(location.city)

  return {
    model: { ...cachedAir.model, fetchedAt: fetchedAt ?? cachedAir.model.fetchedAt },
    official,
    weather: cachedAir.weather,
    fetchedAt: fetchedAt ?? new Date().toISOString(),
  }
}

export { startIndexFor, buildHourly, valuesFromCurrent, valuesFromHourly }

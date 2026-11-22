import type { AqiCategory, PollutantKey, Profile } from '../types'

export { BUDGET_BANDS, COMMUTE_MODES } from './profileOptions.js'

/**
 * CPCB National AQI breakpoints. Values are the official category boundaries,
 * expressed as explicit non-overlapping concentration bands. CO is in mg/m3; all other
 * pollutants are in µg/m3.
 *
 * Sources: CPCB National Air Quality Index (2014) technical document and the
 * CPCB AQI bulletin methodology. Averaging periods are part of the standard and
 * are displayed in the UI. Open-Meteo values are instantaneous model fields, so
 * any index computed from them is an estimate, never an official CPCB AQI.
 */
export interface PollutantDefinition {
  key: PollutantKey
  label: string
  unit: string
  averagingPeriod: string
  bands: readonly ConcentrationBand[]
}

export interface ConcentrationBand {
  concentrationLow: number
  concentrationHigh: number
  aqiLow: number
  aqiHigh: number
}

const band = (concentrationLow: number, concentrationHigh: number, aqiLow: number, aqiHigh: number): ConcentrationBand => ({
  concentrationLow,
  concentrationHigh,
  aqiLow,
  aqiHigh,
})

export const POLLUTANTS: readonly PollutantDefinition[] = [
  {
    key: 'pm25',
    label: 'PM2.5',
    unit: 'µg/m³',
    averagingPeriod: '24-hour average',
    bands: [band(0, 30, 0, 50), band(31, 60, 51, 100), band(61, 90, 101, 200), band(91, 120, 201, 300), band(121, 250, 301, 400), band(251, 500, 401, 500)],
  },
  {
    key: 'pm10',
    label: 'PM10',
    unit: 'µg/m³',
    averagingPeriod: '24-hour average',
    bands: [band(0, 50, 0, 50), band(51, 100, 51, 100), band(101, 250, 101, 200), band(251, 350, 201, 300), band(351, 430, 301, 400), band(431, 600, 401, 500)],
  },
  {
    key: 'no2',
    label: 'NO₂',
    unit: 'µg/m³',
    averagingPeriod: '24-hour average',
    bands: [band(0, 40, 0, 50), band(41, 80, 51, 100), band(81, 180, 101, 200), band(181, 280, 201, 300), band(281, 400, 301, 400), band(401, 600, 401, 500)],
  },
  {
    key: 'so2',
    label: 'SO₂',
    unit: 'µg/m³',
    averagingPeriod: '24-hour average',
    bands: [band(0, 40, 0, 50), band(41, 80, 51, 100), band(81, 380, 101, 200), band(381, 800, 201, 300), band(801, 1600, 301, 400), band(1601, 2000, 401, 500)],
  },
  {
    key: 'co',
    label: 'CO',
    unit: 'mg/m³',
    averagingPeriod: '8-hour average',
    bands: [band(0, 1, 0, 50), band(1.1, 2, 51, 100), band(2.1, 10, 101, 200), band(10.1, 17, 201, 300), band(17.1, 34, 301, 400), band(34.1, 50, 401, 500)],
  },
  {
    key: 'o3',
    label: 'O₃',
    unit: 'µg/m³',
    averagingPeriod: '8-hour average',
    bands: [band(0, 50, 0, 50), band(51, 100, 51, 100), band(101, 168, 101, 200), band(169, 208, 201, 300), band(209, 748, 301, 400), band(749, 1000, 401, 500)],
  },
  {
    key: 'nh3',
    label: 'NH₃',
    unit: 'µg/m³',
    averagingPeriod: '24-hour average',
    bands: [band(0, 200, 0, 50), band(201, 400, 51, 100), band(401, 800, 101, 200), band(801, 1200, 201, 300), band(1201, 1800, 301, 400), band(1801, 2400, 401, 500)],
  },
]

export const POLLUTANT_BY_KEY: Record<PollutantKey, PollutantDefinition> = Object.fromEntries(
  POLLUTANTS.map(definition => [definition.key, definition]),
) as Record<PollutantKey, PollutantDefinition>

export const AQI_SCALE_MAX = 500
export const MIN_VALID_POLLUTANTS = 3

export const AQI_CATEGORY_RANGES: readonly { category: AqiCategory; max: number }[] = [
  { category: 'Good', max: 50 },
  { category: 'Satisfactory', max: 100 },
  { category: 'Moderate', max: 200 },
  { category: 'Poor', max: 300 },
  { category: 'Very Poor', max: 400 },
  { category: 'Severe', max: 500 },
]

export const CATEGORY_CLASS: Record<AqiCategory, string> = {
  Good: 'good',
  Satisfactory: 'satisfactory',
  Moderate: 'moderate',
  Poor: 'poor',
  'Very Poor': 'very-poor',
  Severe: 'severe',
}

export const CATEGORY_SUMMARY: Record<AqiCategory, string> = {
  Good: 'Air quality is acceptable for most people today.',
  Satisfactory: 'Most people can continue normal activity, but sensitive groups should watch for symptoms.',
  Moderate: 'Sensitive groups should reduce prolonged or strenuous outdoor activity.',
  Poor: 'Limit prolonged outdoor exertion, especially for children, older adults and sensitive groups.',
  'Very Poor': 'Avoid strenuous outdoor activity and keep outdoor time short for everyone.',
  Severe: 'Stay indoors where possible and follow local public-health guidance.',
}

export const DEFAULT_PROFILE: Profile = {
  adults: 2,
  children: 0,
  elderly: 0,
  outdoorWorker: false,
  respiratorySensitivity: false,
  cardiovascularSensitivity: false,
  commute: 'Metro',
  commuteDistanceKm: 10,
  workTiming: 'Daytime',
  exerciseFrequency: '1–2 times a week',
  cookingFuel: 'LPG or piped gas',
  ventilation: 'Single-side windows',
  hasPurifier: false,
  roomAreaSqFt: 180,
  budget: 'Under ₹1,500',
}

export const POPULAR_CITIES = [
  { city: 'New Delhi', latitude: 28.6139, longitude: 77.209 },
  { city: 'Mumbai', latitude: 19.076, longitude: 72.8777 },
  { city: 'Bengaluru', latitude: 12.9716, longitude: 77.5946 },
  { city: 'Kolkata', latitude: 22.5726, longitude: 88.3639 },
  { city: 'Chennai', latitude: 13.0827, longitude: 80.2707 },
  { city: 'Hyderabad', latitude: 17.385, longitude: 78.4867 },
] as const

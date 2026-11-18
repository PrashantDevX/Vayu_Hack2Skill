import type { AqiCategory, BudgetBand, CommuteMode, PollutantKey, Profile } from '../types'

/**
 * CPCB National AQI breakpoints. Values are the official category boundaries,
 * expressed as continuous ranges for interpolation. CO is in mg/m3; all other
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
  /** Ascending boundary list, length must equal thresholds.length + 1. */
  boundaries: readonly number[]
  /** AQI sub-index thresholds, length must equal boundaries.length - 1. */
  thresholds: readonly number[]
}

const AQI_THRESHOLDS = [0, 50, 100, 200, 300, 400, 500] as const

export const POLLUTANTS: readonly PollutantDefinition[] = [
  {
    key: 'pm25',
    label: 'PM2.5',
    unit: 'µg/m³',
    averagingPeriod: '24-hour average',
    boundaries: [0, 30, 60, 90, 120, 250, 500],
    thresholds: AQI_THRESHOLDS,
  },
  {
    key: 'pm10',
    label: 'PM10',
    unit: 'µg/m³',
    averagingPeriod: '24-hour average',
    boundaries: [0, 50, 100, 250, 350, 430, 600],
    thresholds: AQI_THRESHOLDS,
  },
  {
    key: 'no2',
    label: 'NO₂',
    unit: 'µg/m³',
    averagingPeriod: '24-hour average',
    boundaries: [0, 40, 80, 180, 280, 400, 600],
    thresholds: AQI_THRESHOLDS,
  },
  {
    key: 'so2',
    label: 'SO₂',
    unit: 'µg/m³',
    averagingPeriod: '24-hour average',
    boundaries: [0, 40, 80, 380, 800, 1600, 2000],
    thresholds: AQI_THRESHOLDS,
  },
  {
    key: 'co',
    label: 'CO',
    unit: 'mg/m³',
    averagingPeriod: '8-hour average',
    boundaries: [0, 1, 2, 10, 17, 34, 50],
    thresholds: AQI_THRESHOLDS,
  },
  {
    key: 'o3',
    label: 'O₃',
    unit: 'µg/m³',
    averagingPeriod: '8-hour average',
    boundaries: [0, 50, 100, 168, 208, 748, 1000],
    thresholds: AQI_THRESHOLDS,
  },
  {
    key: 'nh3',
    label: 'NH₃',
    unit: 'µg/m³',
    averagingPeriod: '24-hour average',
    boundaries: [0, 200, 400, 800, 1200, 1800, 2400],
    thresholds: AQI_THRESHOLDS,
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

export const COMMUTE_MODES: readonly CommuteMode[] = [
  'Metro',
  'Bus',
  'Carpool',
  'Petrol car',
  'Two-wheeler',
  'Walking or cycling',
]

export const BUDGET_BANDS: readonly BudgetBand[] = [
  'Free',
  'Under ₹1,500',
  '₹1,500–₹12,000',
  'Premium solutions',
]

export const POPULAR_CITIES = [
  { city: 'New Delhi', latitude: 28.6139, longitude: 77.209 },
  { city: 'Mumbai', latitude: 19.076, longitude: 72.8777 },
  { city: 'Bengaluru', latitude: 12.9716, longitude: 77.5946 },
  { city: 'Kolkata', latitude: 22.5726, longitude: 88.3639 },
  { city: 'Chennai', latitude: 13.0827, longitude: 80.2707 },
  { city: 'Hyderabad', latitude: 17.385, longitude: 78.4867 },
] as const

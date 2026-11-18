import {
  AQI_CATEGORY_RANGES,
  AQI_SCALE_MAX,
  MIN_VALID_POLLUTANTS,
  POLLUTANT_BY_KEY,
  POLLUTANTS,
} from '../constants/aqi'
import type {
  AqiAssessment,
  AqiCategory,
  DataSourceKind,
  PollutantKey,
  PollutantResult,
  PollutantValues,
} from '../types'

export type { AqiCategory }

/** Category for a valid AQI value. Throws for non-finite or negative input. */
export function getAqiCategory(value: number): AqiCategory {
  if (!Number.isFinite(value) || value < 0) throw new Error('AQI must be a non-negative finite number')
  const match = AQI_CATEGORY_RANGES.find(range => value <= range.max)
  return match ? match.category : 'Severe'
}

export function categoryFromAqi(value: number | null): AqiCategory | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null
  return getAqiCategory(Math.min(value, AQI_SCALE_MAX))
}

/**
 * Linear interpolation of one CPCB sub-index. Returns null when the reading is
 * missing or invalid. Values beyond the published scale are capped at 500 and
 * flagged by the caller.
 */
export function computeSubIndex(key: PollutantKey, concentration: number | null): number | null {
  if (concentration === null || !Number.isFinite(concentration) || concentration < 0) return null
  const definition = POLLUTANT_BY_KEY[key]
  const { boundaries, thresholds } = definition

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const low = boundaries[index]
    const high = boundaries[index + 1]
    if (low === undefined || high === undefined) continue
    if (concentration <= high) {
      const iLow = thresholds[index] ?? 0
      const iHigh = thresholds[index + 1] ?? AQI_SCALE_MAX
      if (high === low) return iHigh
      const interpolated = ((iHigh - iLow) / (high - low)) * (concentration - low) + iLow
      return Math.round(interpolated)
    }
  }

  return AQI_SCALE_MAX
}

export function isBeyondScale(key: PollutantKey, concentration: number | null): boolean {
  if (concentration === null || !Number.isFinite(concentration) || concentration < 0) return false
  const boundaries = POLLUTANT_BY_KEY[key].boundaries
  const last = boundaries[boundaries.length - 1]
  return last !== undefined && concentration > last
}

export function buildPollutantResults(
  values: PollutantValues,
  source: DataSourceKind,
): PollutantResult[] {
  return POLLUTANTS.map(definition => {
    const value = values[definition.key]
    const subIndex = computeSubIndex(definition.key, value)
    return {
      key: definition.key,
      label: definition.label,
      unit: definition.unit,
      averagingPeriod: definition.averagingPeriod,
      value,
      subIndex,
      category: categoryFromAqi(subIndex),
      beyondScale: isBeyondScale(definition.key, value),
      source,
    }
  })
}

/**
 * CPCB overall AQI = highest valid pollutant sub-index. An overall index is
 * only produced when at least three pollutants are valid and at least one is
 * PM2.5 or PM10. This mirrors the CPCB sufficiency rule; it does not turn model
 * concentrations into an official observation.
 */
export function assessAqi(values: PollutantValues, source: DataSourceKind = 'model'): AqiAssessment {
  const pollutants = buildPollutantResults(values, source)
  const valid = pollutants.filter(item => item.subIndex !== null)
  const hasParticulate = valid.some(item => item.key === 'pm25' || item.key === 'pm10')

  if (valid.length < MIN_VALID_POLLUTANTS) {
    return {
      aqi: null,
      category: null,
      status: 'insufficient-coverage',
      reason: `Only ${valid.length} of ${pollutants.length} pollutants have usable values. CPCB requires at least ${MIN_VALID_POLLUTANTS}, including particulate matter.`,
      validPollutants: valid.length,
      requiredPollutants: MIN_VALID_POLLUTANTS,
      hasParticulate,
      pollutants,
      beyondScale: valid.some(item => item.beyondScale),
    }
  }

  if (!hasParticulate) {
    return {
      aqi: null,
      category: null,
      status: 'insufficient-coverage',
      reason: 'No PM2.5 or PM10 reading is available. CPCB requires a particulate-matter sub-index for an overall AQI.',
      validPollutants: valid.length,
      requiredPollutants: MIN_VALID_POLLUTANTS,
      hasParticulate,
      pollutants,
      beyondScale: valid.some(item => item.beyondScale),
    }
  }

  const highest = valid.reduce((max, item) =>
    (item.subIndex ?? 0) > (max.subIndex ?? 0) ? item : max,
  )
  const aqi = Math.min(highest.subIndex ?? 0, AQI_SCALE_MAX)

  return {
    aqi,
    category: categoryFromAqi(aqi),
    status: 'ok',
    reason: null,
    validPollutants: valid.length,
    requiredPollutants: MIN_VALID_POLLUTANTS,
    hasParticulate,
    pollutants,
    beyondScale: valid.some(item => item.beyondScale),
  }
}

export function dominantPollutant(assessment: AqiAssessment): PollutantResult | null {
  let dominant: PollutantResult | null = null
  for (const item of assessment.pollutants) {
    if (item.subIndex === null) continue
    if (dominant === null || item.subIndex > (dominant.subIndex ?? 0)) dominant = item
  }
  return dominant
}

export function formatPollutantValue(value: number | null, key: PollutantKey): string {
  if (value === null || !Number.isFinite(value)) return 'Unavailable'
  const decimals = key === 'co' ? 2 : key === 'pm25' || key === 'pm10' ? 1 : 0
  return value.toFixed(decimals)
}

export function aqiSeverityLabel(aqi: number | null): string {
  if (aqi === null) return 'Unavailable'
  return `${getAqiCategory(aqi)} (${aqi})`
}

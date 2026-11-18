import { describe, expect, it } from 'vitest'
import {
  assessAqi,
  computeSubIndex,
  dominantPollutant,
  formatPollutantValue,
  getAqiCategory,
  isBeyondScale,
} from './aqi'
import type { PollutantValues } from '../types'

const emptyValues: PollutantValues = {
  pm25: null,
  pm10: null,
  no2: null,
  so2: null,
  co: null,
  o3: null,
  nh3: null,
}

describe('CPCB category boundaries', () => {
  it('maps every category boundary', () => {
    expect(getAqiCategory(0)).toBe('Good')
    expect(getAqiCategory(50)).toBe('Good')
    expect(getAqiCategory(51)).toBe('Satisfactory')
    expect(getAqiCategory(100)).toBe('Satisfactory')
    expect(getAqiCategory(101)).toBe('Moderate')
    expect(getAqiCategory(200)).toBe('Moderate')
    expect(getAqiCategory(201)).toBe('Poor')
    expect(getAqiCategory(300)).toBe('Poor')
    expect(getAqiCategory(301)).toBe('Very Poor')
    expect(getAqiCategory(400)).toBe('Very Poor')
    expect(getAqiCategory(401)).toBe('Severe')
    expect(getAqiCategory(900)).toBe('Severe')
  })

  it('rejects invalid AQI input', () => {
    expect(() => getAqiCategory(-1)).toThrow()
    expect(() => getAqiCategory(Number.NaN)).toThrow()
    expect(() => getAqiCategory(Number.POSITIVE_INFINITY)).toThrow()
  })
})

describe('CPCB sub-index interpolation', () => {
  it('maps PM2.5 breakpoints and midpoints', () => {
    expect(computeSubIndex('pm25', 0)).toBe(0)
    expect(computeSubIndex('pm25', 30)).toBe(50)
    expect(computeSubIndex('pm25', 45)).toBe(75)
    expect(computeSubIndex('pm25', 60)).toBe(100)
    expect(computeSubIndex('pm25', 90)).toBe(200)
    expect(computeSubIndex('pm25', 120)).toBe(300)
    expect(computeSubIndex('pm25', 250)).toBe(400)
    expect(computeSubIndex('pm25', 500)).toBe(500)
  })

  it('maps PM10, NO2 and CO breakpoints', () => {
    expect(computeSubIndex('pm10', 75)).toBe(75)
    expect(computeSubIndex('pm10', 600)).toBe(500)
    expect(computeSubIndex('no2', 80)).toBe(100)
    expect(computeSubIndex('no2', 180)).toBe(200)
    expect(computeSubIndex('co', 1.5)).toBe(75)
    expect(computeSubIndex('co', 10)).toBe(200)
  })

  it('caps values beyond the published scale and flags them', () => {
    expect(computeSubIndex('pm25', 700)).toBe(500)
    expect(computeSubIndex('pm10', 700)).toBe(500)
    expect(isBeyondScale('pm25', 501)).toBe(true)
    expect(isBeyondScale('pm25', 100)).toBe(false)
  })

  it('returns null for invalid concentrations', () => {
    expect(computeSubIndex('pm25', null)).toBeNull()
    expect(computeSubIndex('pm25', -2)).toBeNull()
    expect(computeSubIndex('pm25', Number.NaN)).toBeNull()
  })
})

describe('CPCB overall AQI', () => {
  it('uses the highest valid sub-index rather than an average', () => {
    const assessment = assessAqi({
      ...emptyValues,
      pm25: 90,
      pm10: 100,
      no2: 40,
    })
    expect(assessment.status).toBe('ok')
    expect(assessment.aqi).toBe(200)
    expect(assessment.category).toBe('Moderate')
    expect(assessment.validPollutants).toBe(3)
    expect(dominantPollutant(assessment)?.key).toBe('pm25')
  })

  it('refuses an overall AQI with fewer than three pollutants', () => {
    const assessment = assessAqi({ ...emptyValues, pm25: 100, pm10: 100 })
    expect(assessment.aqi).toBeNull()
    expect(assessment.status).toBe('insufficient-coverage')
    expect(assessment.reason).toContain('at least 3')
    expect(assessment.validPollutants).toBe(2)
  })

  it('refuses an overall AQI without a particulate sub-index', () => {
    const assessment = assessAqi({ ...emptyValues, no2: 100, so2: 100, o3: 100 })
    expect(assessment.aqi).toBeNull()
    expect(assessment.status).toBe('insufficient-coverage')
    expect(assessment.hasParticulate).toBe(false)
    expect(assessment.reason).toContain('PM2.5 or PM10')
  })

  it('handles missing pollutants without inventing values', () => {
    const assessment = assessAqi({ ...emptyValues, pm25: 60, pm10: null, no2: 40, so2: 20 })
    expect(assessment.status).toBe('ok')
    expect(assessment.validPollutants).toBe(3)
    expect(assessment.aqi).toBe(100)
    expect(assessment.pollutants.filter(item => item.value === null)).toHaveLength(4)
  })

  it('flags beyond-scale readings while capping the index', () => {
    const assessment = assessAqi({ ...emptyValues, pm25: 900, pm10: 100, no2: 40 })
    expect(assessment.aqi).toBe(500)
    expect(assessment.category).toBe('Severe')
    expect(assessment.beyondScale).toBe(true)
  })

  it('formats values and unavailable readings', () => {
    expect(formatPollutantValue(12.345, 'pm25')).toBe('12.3')
    expect(formatPollutantValue(0.456, 'co')).toBe('0.46')
    expect(formatPollutantValue(42.6, 'no2')).toBe('43')
    expect(formatPollutantValue(null, 'pm10')).toBe('Unavailable')
  })
})

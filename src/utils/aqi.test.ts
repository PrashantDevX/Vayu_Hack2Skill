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
  it('matches the official CPCB concentration-band starts and ends for each pollutant', () => {
    const cases = [
      ['pm25', [[0, 0, 30, 50], [31, 51, 60, 100], [61, 101, 90, 200], [91, 201, 120, 300], [121, 301, 250, 400], [251, 401, 500, 500]]],
      ['pm10', [[0, 0, 50, 50], [51, 51, 100, 100], [101, 101, 250, 200], [251, 201, 350, 300], [351, 301, 430, 400], [431, 401, 600, 500]]],
      ['no2', [[0, 0, 40, 50], [41, 51, 80, 100], [81, 101, 180, 200], [181, 201, 280, 300], [281, 301, 400, 400], [401, 401, 600, 500]]],
      ['so2', [[0, 0, 40, 50], [41, 51, 80, 100], [81, 101, 380, 200], [381, 201, 800, 300], [801, 301, 1600, 400], [1601, 401, 2000, 500]]],
      ['co', [[0, 0, 1, 50], [1.1, 51, 2, 100], [2.1, 101, 10, 200], [10.1, 201, 17, 300], [17.1, 301, 34, 400], [34.1, 401, 50, 500]]],
      ['o3', [[0, 0, 50, 50], [51, 51, 100, 100], [101, 101, 168, 200], [169, 201, 208, 300], [209, 301, 748, 400], [749, 401, 1000, 500]]],
      ['nh3', [[0, 0, 200, 50], [201, 51, 400, 100], [401, 101, 800, 200], [801, 201, 1200, 300], [1201, 301, 1800, 400], [1801, 401, 2400, 500]]],
    ] as const

    for (const [pollutant, bands] of cases) {
      for (const [low, aqiLow, high, aqiHigh] of bands) {
        expect(computeSubIndex(pollutant, low), `${pollutant} at band start ${low}`).toBe(aqiLow)
        expect(computeSubIndex(pollutant, high), `${pollutant} at band end ${high}`).toBe(aqiHigh)
      }
    }
  })

  it('matches CPCB transition examples and interpolates fractional inputs consistently', () => {
    expect(computeSubIndex('pm25', 31)).toBe(51)
    expect(computeSubIndex('pm25', 45)).toBe(75)
    expect(computeSubIndex('pm25', 30.5)).toBe(51)
    expect(computeSubIndex('co', 1.1)).toBe(51)
    expect(computeSubIndex('co', 1.05)).toBe(51)
    expect(computeSubIndex('nh3', 201)).toBe(51)
    expect(computeSubIndex('nh3', 200.5)).toBe(51)
  })

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
    expect(computeSubIndex('co', 1.5)).toBe(73)
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
    expect(computeSubIndex('pm25', Number.POSITIVE_INFINITY)).toBeNull()
    expect(computeSubIndex('pm25', Number.NEGATIVE_INFINITY)).toBeNull()
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

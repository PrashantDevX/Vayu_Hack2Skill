import { describe, expect, it } from 'vitest'
import {
  budgetRank,
  compareTransport,
  estimateAnnualCo2e,
  estimateCadr,
  estimateTransport,
  exposureProxy,
  sumExposureProxy,
  TRANSPORT_FACTOR_VERSION,
} from './impact'
import type { HourlyPoint } from '../types'

describe('transport emissions', () => {
  it('calculates annual round-trip emissions for a petrol car', () => {
    const result = estimateTransport({ oneWayKm: 18, daysPerWeek: 5, mode: 'Petrol car' })
    expect(result.weeklyKg).toBeCloseTo(34.56)
    expect(result.monthlyKg).toBeCloseTo(149.76)
    expect(result.annualKg).toBeCloseTo(1797.12)
  })

  it('compares a car baseline with metro and reports a range', () => {
    const result = compareTransport({ oneWayKm: 18, daysPerWeek: 5, alternative: 'Metro' })
    expect(result.baseline.mode).toBe('Petrol car')
    expect(result.alternative.mode).toBe('Metro')
    expect(result.annualSavingsKg).toBeGreaterThan(1000)
    expect(result.annualSavingsLowKg).toBeLessThan(result.annualSavingsKg)
    expect(result.annualSavingsHighKg).toBeGreaterThan(result.annualSavingsKg)
    expect(result.factorVersion).toBe(TRANSPORT_FACTOR_VERSION)
    expect(result.assumptions.join(' ')).toContain('not a city-scale AQI change')
  })

  it('divides the car factor by carpool occupancy', () => {
    const solo = estimateTransport({ oneWayKm: 20, daysPerWeek: 5, mode: 'Carpool', occupancy: 1 })
    const shared = estimateTransport({ oneWayKm: 20, daysPerWeek: 5, mode: 'Carpool', occupancy: 4 })
    expect(shared.factorKgPerPassengerKm).toBeCloseTo(solo.factorKgPerPassengerKm / 4)
    expect(shared.annualKg).toBeCloseTo(solo.annualKg / 4)
  })

  it('returns zero direct emissions for walking or cycling', () => {
    const result = estimateTransport({ oneWayKm: 5, daysPerWeek: 7, mode: 'Walking or cycling' })
    expect(result.annualKg).toBe(0)
  })

  it('rejects invalid distance, days and occupancy', () => {
    expect(() => estimateTransport({ oneWayKm: -1, daysPerWeek: 5, mode: 'Metro' })).toThrow()
    expect(() => estimateTransport({ oneWayKm: 5, daysPerWeek: 8, mode: 'Metro' })).toThrow()
    expect(() => estimateTransport({ oneWayKm: 5, daysPerWeek: 5, mode: 'Carpool', occupancy: 0 })).toThrow()
  })

  it('keeps the legacy annual helper deterministic', () => {
    expect(estimateAnnualCo2e(18, 5, 0.192)).toBeCloseTo(1797.12)
    expect(() => estimateAnnualCo2e(-1, 5, 0.192)).toThrow()
  })
})

describe('exposure proxy', () => {
  it('multiplies concentration by hours without claiming dose', () => {
    expect(exposureProxy(100, 2)).toBe(200)
    expect(exposureProxy(null, 2)).toBeNull()
    expect(() => exposureProxy(100, -1)).toThrow()
  })

  it('sums hourly PM2.5 for a window and rejects incomplete data', () => {
    const points: HourlyPoint[] = [
      { time: '2026-11-18T10:00', label: '10:00', pm25: 80, aqi: 150, category: 'Moderate' },
      { time: '2026-11-18T11:00', label: '11:00', pm25: 60, aqi: 120, category: 'Moderate' },
      { time: '2026-11-18T12:00', label: '12:00', pm25: null, aqi: null, category: null },
    ]
    expect(sumExposureProxy(points, 0, 2)).toBe(140)
    expect(sumExposureProxy(points, 1, 2)).toBeNull()
    expect(sumExposureProxy([], 0, 2)).toBeNull()
  })
})

describe('room sizing', () => {
  it('calculates room volume and CADR for 4–5 air changes', () => {
    const result = estimateCadr({ areaSqFt: 180, ceilingFt: 9 })
    expect(result.volumeFt3).toBe(1620)
    expect(result.volumeM3).toBeCloseTo(45.9)
    expect(result.cadrM3hLow).toBe(183)
    expect(result.cadrM3hHigh).toBe(229)
  })

  it('supports a higher ACH target for vulnerable households', () => {
    const normal = estimateCadr({ areaSqFt: 180, achHigh: 5 })
    const vulnerable = estimateCadr({ areaSqFt: 180, achHigh: 6 })
    expect(vulnerable.cadrM3hHigh).toBeGreaterThan(normal.cadrM3hHigh)
  })

  it('rejects invalid rooms and ACH targets', () => {
    expect(() => estimateCadr({ areaSqFt: 0 })).toThrow()
    expect(() => estimateCadr({ areaSqFt: 100, achLow: 0 })).toThrow()
    expect(() => estimateCadr({ areaSqFt: 100, achLow: 5, achHigh: 4 })).toThrow()
  })

  it('orders budgets for filtering', () => {
    expect(budgetRank('Free')).toBeLessThan(budgetRank('Under ₹1,500'))
    expect(budgetRank('Premium solutions')).toBeGreaterThan(budgetRank('₹1,500–₹12,000'))
    expect(budgetRank('unknown')).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import {
  buildPlanner,
  findBestWorstWindows,
  localBriefFallback,
  recommendationTitle,
} from './recommendationService'
import { assessAqi } from '../utils/aqi'
import { DEFAULT_PROFILE } from '../constants/aqi'
import type { HourlyPoint, PollutantValues } from '../types'

const baseValues: PollutantValues = {
  pm25: 90,
  pm10: 100,
  no2: 40,
  so2: 20,
  co: 0.5,
  o3: 30,
  nh3: 50,
}

function hourly(values: number[]): HourlyPoint[] {
  return values.map((aqi, index) => ({
    time: `2026-11-18T${String(index).padStart(2, '0')}:00`,
    label: `${String(index).padStart(2, '0')}:00`,
    pm25: Math.round(aqi / 2),
    aqi,
    category: aqi <= 50 ? 'Good' : aqi <= 100 ? 'Satisfactory' : aqi <= 200 ? 'Moderate' : aqi <= 300 ? 'Poor' : aqi <= 400 ? 'Very Poor' : 'Severe',
  }))
}

describe('forecast windows', () => {
  it('finds the best and worst two-hour windows from actual values', () => {
    const result = findBestWorstWindows(hourly([80, 120, 300, 350, 50, 60]), 2)
    expect(result.best?.start).toBe('04:00')
    expect(result.best?.end).toBe('06:00')
    expect(result.best?.averageAqi).toBe(55)
    expect(result.worst?.start).toBe('02:00')
    expect(result.worst?.averageAqi).toBe(325)
  })

  it('skips windows with missing AQI and returns null when none remain', () => {
    const points = hourly([100, 120, 140])
    points[1] = { ...points[1]!, aqi: null, category: null }
    expect(findBestWorstWindows(points, 2)).toEqual({ best: null, worst: null })
    expect(findBestWorstWindows([], 2)).toEqual({ best: null, worst: null })
  })

  it('rejects invalid window lengths', () => {
    expect(() => findBestWorstWindows([], 0)).toThrow()
  })
})

describe('personalized planner', () => {
  const assessment = assessAqi(baseValues)

  it('builds a complete plan with unique IDs and all required fields', () => {
    const plan = buildPlanner({ assessment, hourly: hourly([180, 200, 160, 140]), profile: DEFAULT_PROFILE })
    expect(plan.recommendations.length).toBeGreaterThanOrEqual(6)
    expect(new Set(plan.recommendations.map(item => item.id)).size).toBe(plan.recommendations.length)
    for (const item of plan.recommendations) {
      expect(item.title).toBeTruthy()
      expect(item.action).toBeTruthy()
      expect(item.explanation).toBeTruthy()
      expect(item.environmentalContext).toContain('Estimated CPCB-style model AQI 200')
      expect(item.beneficiaries.length).toBeGreaterThan(0)
      expect(item.limitations).toBeTruthy()
      expect(item.sources.length).toBeGreaterThan(0)
    }
    expect(plan.bestWindow).not.toBeNull()
    expect(plan.contextSummary).toContain('Moderate')
  })

  it('adds school, elderly and outdoor-worker actions only when relevant', () => {
    const plain = buildPlanner({ assessment, hourly: hourly([180, 200]), profile: DEFAULT_PROFILE })
    const tailored = buildPlanner({
      assessment,
      hourly: hourly([180, 200]),
      profile: { ...DEFAULT_PROFILE, children: 2, elderly: 1, outdoorWorker: true },
    })
    expect(plain.recommendations.some(item => item.id === 'school-protection')).toBe(false)
    expect(tailored.recommendations.some(item => item.id === 'school-protection')).toBe(true)
    expect(tailored.recommendations.some(item => item.id === 'elderly-precautions')).toBe(true)
    expect(tailored.recommendations.some(item => item.id === 'outdoor-worker')).toBe(true)
  })

  it('advises closing windows when the estimate is elevated', () => {
    const plan = buildPlanner({ assessment, hourly: hourly([250, 280]), profile: DEFAULT_PROFILE })
    const morning = plan.recommendations.find(item => item.id === 'morning-windows')
    expect(morning?.action.toLowerCase()).toContain('keep windows closed')
  })

  it('advises using a cleaner window when air is good', () => {
    const clean = assessAqi({ ...baseValues, pm25: 20, pm10: 30, no2: 20 })
    const plan = buildPlanner({ assessment: clean, hourly: hourly([40, 45, 30, 35]), profile: DEFAULT_PROFILE })
    const morning = plan.recommendations.find(item => item.id === 'morning-windows')
    expect(morning?.action.toLowerCase()).toContain('cleaner morning window')
  })

  it('never recommends ozone devices and keeps ventilation conditional', () => {
    const plan = buildPlanner({
      assessment,
      hourly: hourly([250, 280]),
      profile: { ...DEFAULT_PROFILE, budget: 'Premium solutions', hasPurifier: false },
    })
    const guidance = plan.recommendations
      .map(item => `${item.action} ${item.explanation}`)
      .join(' ')
      .toLowerCase()
    const allText = `${guidance} ${plan.recommendations.map(item => item.limitations).join(' ')}`.toLowerCase()
    expect(guidance).not.toContain('use ozone')
    expect(guidance).not.toContain('ozone generator is recommended')
    expect(allText).toContain('never use ozone generators')
    const evening = plan.recommendations.find(item => item.id === 'evening-ventilation')
    expect(evening?.action.toLowerCase()).toContain('keep windows closed')
  })

  it('does not invent an AQI when coverage is insufficient', () => {
    const empty = assessAqi({ pm25: null, pm10: null, no2: null, so2: null, co: null, o3: null, nh3: null })
    const plan = buildPlanner({ assessment: empty, hourly: [], profile: DEFAULT_PROFILE })
    expect(plan.recommendations.length).toBeGreaterThan(0)
    expect(plan.bestWindow).toBeNull()
    expect(plan.worstWindow).toBeNull()
    expect(plan.contextSummary).toContain('unavailable')
    expect(plan.contextSummary).not.toContain('AQI 0')
  })

  it('provides a deterministic fallback brief with no AI claim', () => {
    const brief = localBriefFallback({
      assessment,
      hourly: hourly([180, 200, 160]),
      profile: DEFAULT_PROFILE,
    })
    expect(brief.source).toBe('unavailable')
    expect(brief.sections.length).toBeGreaterThan(0)
    expect(brief.reason).toContain('deterministic')
  })

  it('maps categories to readable section titles', () => {
    expect(recommendationTitle('school')).toBe('School and children')
    expect(recommendationTitle('night')).toBe('Night-time environment')
  })
})

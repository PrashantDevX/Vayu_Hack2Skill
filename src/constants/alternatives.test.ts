import { describe, expect, it } from 'vitest'
import { COMMUNITY_ALTERNATIVES, HOUSEHOLD_ALTERNATIVES } from './alternatives'

const ALL = [...HOUSEHOLD_ALTERNATIVES, ...COMMUNITY_ALTERNATIVES]

describe('sustainable alternatives', () => {
  it('covers household and community measures', () => {
    expect(HOUSEHOLD_ALTERNATIVES.length).toBeGreaterThanOrEqual(3)
    expect(COMMUNITY_ALTERNATIVES.length).toBeGreaterThanOrEqual(4)
    expect(new Set(ALL.map(item => item.id)).size).toBe(ALL.length)
  })

  it('states every field the brief requires', () => {
    for (const item of ALL) {
      expect(item.currentBehaviour.length).toBeGreaterThan(10)
      expect(item.alternative.length).toBeGreaterThan(10)
      expect(item.cost.length).toBeGreaterThan(10)
      expect(item.practicality.length).toBeGreaterThan(10)
      expect(item.environmentalBenefit.length).toBeGreaterThan(10)
      expect(item.estimatedAvoidedEmissions.length).toBeGreaterThan(10)
      expect(item.methodology.length).toBeGreaterThan(10)
      expect(item.limitations.length).toBeGreaterThan(10)
      expect(item.sources.length).toBeGreaterThan(0)
      expect(['Established', 'Likely', 'Indicative']).toContain(item.evidenceLevel)
    }
  })

  it('does not invent kilogram savings for measures it cannot measure', () => {
    for (const item of ALL) {
      expect(item.estimatedAvoidedEmissions).not.toMatch(/\d+\s*(kg|tonnes?|t)\b/i)
    }
  })

  it('never recommends burning waste, ozone devices or unsafe DIY', () => {
    const advice = ALL.map(item => `${item.alternative} ${item.environmentalBenefit}`).join(' ').toLowerCase()
    expect(advice).not.toContain('ozone generator')
    expect(advice).not.toMatch(/\bburn (your|household) (waste|plastic)\b/)
    expect(advice).toContain('compost')
  })
})

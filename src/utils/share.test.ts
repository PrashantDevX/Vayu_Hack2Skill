import { describe, expect, it, vi } from 'vitest'
import { buildShareText, copyToClipboard } from './share'
import type { AqiAssessment, PlannerResult, Recommendation } from '../types'

function recommendation(id: string, title: string, action: string): Recommendation {
  return {
    id,
    title,
    category: 'morning',
    action,
    suggestedTime: '05:00',
    explanation: 'Explanation',
    environmentalContext: 'Context',
    beneficiaries: ['Everyone in the household'],
    cost: 'Free',
    effort: 'Low',
    benefitType: 'Lower exposure',
    evidenceLevel: 'Established',
    limitations: 'Limitations',
    sources: ['WHO_AIR_QUALITY_GUIDELINES'],
  }
}

const planner: PlannerResult = {
  recommendations: [
    recommendation('morning-windows', 'Use the cleaner morning window', 'Open windows briefly between 05:00 and 07:00.'),
    recommendation('commute-lower-exposure', 'Choose the lower-exposure commute', 'Take the metro instead of driving alone.'),
    recommendation('indoor-source-control', 'Control indoor sources first', 'Run the kitchen exhaust while cooking.'),
    recommendation('filtration', 'Size filtration to the room', 'Check the rated CADR.'),
  ],
  bestWindow: { start: '05:00', end: '07:00', averageAqi: 88, averagePm25: 42.5 },
  worstWindow: { start: '19:00', end: '21:00', averageAqi: 260, averagePm25: 180 },
  generatedAt: '2026-11-21T04:00:00.000Z',
  contextSummary: 'Summary',
}

const assessment: AqiAssessment = {
  aqi: 214,
  category: 'Poor',
  status: 'ok',
  reason: null,
  validPollutants: 4,
  requiredPollutants: 3,
  hasParticulate: true,
  pollutants: [],
  beyondScale: false,
}

describe('buildShareText', () => {
  it('summarises the reading, both windows and the first actions', () => {
    const text = buildShareText({ city: 'Delhi', assessment, planner })

    expect(text).toContain('Delhi')
    expect(text).toContain('Estimated CPCB-style model AQI 214 (Poor).')
    expect(text).toContain('05:00–07:00')
    expect(text).toContain('19:00–21:00')
    expect(text).toContain("Today’s actions:")
    expect(text).toContain('1. Use the cleaner morning window')
    // Three actions by default, so the message stays short enough to send.
    expect(text).not.toContain('4. Size filtration to the room')
  })

  it('always labels the number as a model estimate rather than an official reading', () => {
    const text = buildShareText({ city: 'Delhi', assessment, planner })
    expect(text).toContain('not an official CPCB station reading')
    expect(text).toContain('not medical advice')
  })

  it('states unavailable data instead of omitting the reading', () => {
    const text = buildShareText({
      city: 'Delhi',
      assessment: { ...assessment, aqi: null, category: null, status: 'insufficient-coverage' },
      planner: { ...planner, bestWindow: null, worstWindow: null },
    })
    expect(text).toContain('unavailable right now')
    expect(text).toContain('not identified')
    expect(text).not.toMatch(/\bAQI \d/)
  })

  it('leaves household-specific recommendations out of a forwarded message', () => {
    const withHouseholdItems: PlannerResult = {
      ...planner,
      recommendations: [
        recommendation('school-protection', 'Plan the school commute around cleaner air', 'Keep outdoor school travel short.'),
        recommendation('elderly-precautions', 'Reduce exertion for older household members', 'Move errands to the cleaner window.'),
        recommendation('outdoor-worker', 'Schedule outdoor work breaks', 'Shift strenuous tasks away from the worst window.'),
        ...planner.recommendations,
      ],
    }

    const text = buildShareText({ city: 'Delhi', assessment, planner: withHouseholdItems })

    expect(text).not.toContain('Plan the school commute')
    expect(text).not.toContain('older household members')
    expect(text).not.toContain('Schedule outdoor work breaks')
    expect(text).toContain('Use the cleaner morning window')
  })

  it('never carries household composition or device identifiers', () => {
    const text = buildShareText({ city: 'Delhi', assessment, planner })
    const lowered = text.toLowerCase()
    for (const forbidden of ['adults:', 'respiratory', 'cardiovascular', 'latitude', 'longitude', 'sq ft']) {
      expect(lowered).not.toContain(forbidden)
    }
  })

  it('honours an explicit action limit', () => {
    const text = buildShareText({ city: 'Delhi', assessment, planner, maxActions: 1 })
    expect(text).toContain('1. Use the cleaner morning window')
    expect(text).not.toContain('2. Choose the lower-exposure commute')
  })
})

describe('copyToClipboard', () => {
  it('reports success when the clipboard accepts the text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copyToClipboard('hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
    vi.unstubAllGlobals()
  })

  it('reports failure when the clipboard rejects instead of throwing', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })

    await expect(copyToClipboard('hello')).resolves.toBe(false)
    vi.unstubAllGlobals()
  })

  it('reports failure when the clipboard API is missing', async () => {
    vi.stubGlobal('navigator', {})

    await expect(copyToClipboard('hello')).resolves.toBe(false)
    vi.unstubAllGlobals()
  })
})

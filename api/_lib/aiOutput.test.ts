/* @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { inspectAiText, isChatOutputRelevant, isPlanSectionRelevant } from './aiOutput'

describe('AI output safety and relevance checks', () => {
  it.each([
    'Install an ozone generator in the bedroom.',
    'Attach a filter to a box fan with tape and run it overnight.',
    'Take medication to treat pollution exposure.',
    'This purifier reduces indoor PM2.5 by 90%.',
    'Open the windows now while AQI is high.',
    'This will immediately lower city AQI by 10 points.',
  ])('rejects unsafe or unsupported output: %s', text => {
    expect(inspectAiText(text, { aqi: 180 }).length).toBeGreaterThan(0)
  })

  it('allows bounded, cautious advice and rejects irrelevant outputs', () => {
    const safe = 'Use a correctly sized commercial purifier if available and follow its manufacturer instructions.'
    expect(inspectAiText(safe, { aqi: 180 })).toEqual([])
    expect(isPlanSectionRelevant('Commute', 'Use the metro for the school commute.')).toBe(true)
    expect(isPlanSectionRelevant('Commute', 'Keep your purifier running in the bedroom.')).toBe(false)
    expect(isChatOutputRelevant('How should I commute?', 'Use the metro when practical.')).toBe(true)
    expect(isChatOutputRelevant('How should I commute?', 'Use a purifier in the bedroom.')).toBe(false)
  })
})

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

  it('rejects emissions arithmetic the model is not allowed to perform', () => {
    // The exact live answer to "how much CO2 do I save by cycling 10 km?".
    expect(inspectAiText(
      'Cycling 10 km instead of driving a petrol car typically saves about 1.5 to 2.3 kilograms of CO2 emissions.',
      { aqi: 180 },
    )).toContain('unsupported_emission')
    // Naming the metric without a number is fine.
    expect(inspectAiText('Vayu computes CO2e savings in the Impact simulator from per-km factors.', { aqi: 180 }))
      .toEqual([])
  })

  it('does not treat a warning against an unsafe action as the recommendation itself', () => {
    // These are the exact sentences the live model produced. Each one was
    // previously rejected, discarding an otherwise valid daily brief.
    expect(inspectAiText('Keep windows shut and avoid any improvised filtration devices.', { aqi: 180 })).toEqual([])
    expect(inspectAiText('Never build or attach your own filter to a fan.', { aqi: 180 })).toEqual([])
    expect(inspectAiText('Do not open the windows while outdoor pollution is elevated.', { aqi: 180 })).toEqual([])
    expect(inspectAiText('Do not stop prescribed medication without speaking to a clinician.', { aqi: 180 })).toEqual([])
    // The recommendation form must still be rejected.
    expect(inspectAiText('Attach the filter to a fan tonight.', { aqi: 180 })).toContain('unsafe_diy_filtration')
    expect(inspectAiText('Open the windows now while AQI is high.', { aqi: 180 })).toContain('blind_ventilation')
  })

  it('accepts natural wording for a plan section, not just its keywords', () => {
    // The live model wrote this for the "Indoor environment" title. It is on
    // topic, but matched none of the original keywords.
    expect(isPlanSectionRelevant(
      'Indoor environment',
      'You may open windows to air out your home during the cleaner forecast window between 14:00 and 16:00.',
    )).toBe(true)
    expect(isPlanSectionRelevant('Night-time environment', 'Keep the bedroom window closed and run the purifier on low.'))
      .toBe(true)
  })
})

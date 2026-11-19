import { afterEach, describe, expect, it, vi } from 'vitest'
import { askVayu, fallbackChatAnswer } from './chatService'
import { DEFAULT_PROFILE } from '../constants/aqi'
import type { ChatContext } from './chatService'

const context: ChatContext = {
  city: 'New Delhi',
  aqi: 250,
  category: 'Poor',
  pm25: 180,
  bestWindow: '04:00–06:00',
  worstWindow: '18:00–20:00',
  profile: DEFAULT_PROFILE,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('deterministic chat fallback', () => {
  it('uses actual context for exercise guidance', () => {
    const answer = fallbackChatAnswer('Is it safe to go running?', context)
    expect(answer.source).toBe('fallback')
    expect(answer.answer).toContain('250')
    expect(answer.answer.toLowerCase()).toContain('avoid strenuous outdoor exercise')
    expect(answer.answer).toContain('04:00–06:00')
    expect(answer.answer).toContain('not a diagnosis or medical treatment')
  })

  it('covers purifier, windows, school, transport, masks and severe AQI questions', () => {
    for (const question of [
      'How do I choose a purifier?',
      'Should I open the windows?',
      'What about my child at school?',
      'Should we take the metro?',
      'Do we need an N95 mask?',
      'What should we do at AQI 400 severe?',
      'Anything else?',
    ]) {
      const answer = fallbackChatAnswer(question, context)
      expect(answer.answer.length).toBeGreaterThan(50)
      expect(answer.sources.length).toBeGreaterThan(0)
      expect(answer.answer).not.toContain('undefined')
    }
  })

  it('admits missing AQI instead of inventing one', () => {
    const answer = fallbackChatAnswer('Is it safe outside?', { ...context, aqi: null, category: null })
    expect(answer.answer).toContain('unavailable')
    expect(answer.answer).not.toContain('250')
  })

  it('differentiates purifier advice by the budget it was given', () => {
    const tight = fallbackChatAnswer('Which purifier should I buy?', {
      ...context,
      profile: { ...DEFAULT_PROFILE, budget: 'Under ₹1,500' },
    })
    const premium = fallbackChatAnswer('Which purifier should I buy?', {
      ...context,
      profile: { ...DEFAULT_PROFILE, budget: 'Premium solutions' },
    })
    expect(tight.answer).not.toBe(premium.answer)
    expect(tight.answer).toContain('source control')
    expect(premium.answer).toContain('air changes per hour')
    expect(premium.answer).not.toContain('prioritise source control')
  })

  it('routes the common opening questions instead of deflecting them', () => {
    const ambient = fallbackChatAnswer('What is the air quality right now?', context)
    expect(ambient.answer).toContain('250')
    expect(ambient.answer).not.toContain('I can help with air quality')

    const indoor = fallbackChatAnswer('What causes indoor air pollution?', context)
    expect(indoor.answer.toLowerCase()).toContain('source-control')

    const definition = fallbackChatAnswer('What does PM2.5 mean?', context)
    expect(definition.answer).toContain('particulate matter')

    const pregnancy = fallbackChatAnswer('I am pregnant, is it safe?', context)
    expect(pregnancy.answer).toContain('antenatal clinician')

    const worker = fallbackChatAnswer('What should an outdoor worker do today?', context)
    expect(worker.answer).toContain('task rotation')
  })

  it('keeps out-of-scope and medical questions out of the pollution advice path', () => {
    const movie = fallbackChatAnswer('Recommend a movie.', context)
    expect(movie.answer).toContain('I can help with air quality')

    const medical = fallbackChatAnswer('Diagnose my asthma from this AQI.', context)
    expect(medical.answer).toContain('medical advice')
    expect(medical.answer).not.toMatch(/diagnose|prescribe/i)
  })
})

describe('chat client', () => {
  it('accepts a valid structured Gemini response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ source: 'gemini', answer: 'Use the cleaner window.', sources: ['OPEN_METEO_MODEL'] }), { status: 200 }),
      ),
    )
    const result = await askVayu({ message: 'When should I walk?', context })
    expect(result.source).toBe('gemini')
    expect(result.answer).toBe('Use the cleaner window.')
    const init = vi.mocked(fetch).mock.calls[0]![1] as RequestInit
    const body = JSON.parse(String(init.body))
    expect(body.message).toBe('When should I walk?')
    expect(body.preferences.commute).toBe('Metro')
    expect(body).not.toHaveProperty('name')
  })

  it('falls back when the API fails or returns an invalid shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })))
    const failed = await askVayu({ message: 'Is running safe?', context })
    expect(failed.source).toBe('fallback')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ answer: '' }), { status: 200 })))
    const invalid = await askVayu({ message: 'Is running safe?', context })
    expect(invalid.source).toBe('fallback')
  })
})

import { describe, expect, it } from 'vitest'
import { classifyChatIntent, fallbackChatAnswer } from './chatFallback'

const context = {
  city: 'New Delhi',
  aqi: 320,
  category: 'Very Poor',
  pm25: 210,
  bestWindow: '04:00–06:00',
  worstWindow: '18:00–20:00',
  profile: {
    roomAreaSqFt: 180,
    commute: 'Petrol car' as const,
    budget: 'Under ₹1,500' as const,
    children: 1,
    elderly: 1,
    respiratorySensitivity: true,
    cardiovascularSensitivity: false,
  },
}

describe('deterministic chat fallback', () => {
  it.each([
    ['What is the air quality right now?', 'ambient'],
    ['What causes indoor air pollution?', 'indoor'],
    ['How should I ventilate my flat?', 'ventilation'],
    ['How do I choose a purifier?', 'purifier'],
    ['Diagnose my asthma from this AQI.', 'medical'],
  ])('routes %s to %s', (question, intent) => {
    expect(classifyChatIntent(question)).toBe(intent)
  })

  it('uses real context and safety language in the ambient fallback', () => {
    const answer = fallbackChatAnswer('What is the air quality right now?', context)
    expect(answer.answer).toContain('320')
    expect(answer.answer).toContain('04:00–06:00')
    expect(answer.answer).toContain('not an official CPCB station reading')
  })

  it('keeps purifier advice budget-aware and ozone-safe', () => {
    const answer = fallbackChatAnswer('How do I choose a purifier?', context)
    expect(answer.answer).toContain('source control')
    expect(answer.answer).toContain('Avoid ozone-generating devices')
  })
})

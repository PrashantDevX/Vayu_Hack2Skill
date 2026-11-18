/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from './plan'
import { clearRateLimits } from './lib/rateLimit'

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }))

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent }
  },
}))

const body = {
  location: { city: 'New Delhi', aqi: 200, category: 'Moderate', pm25: 90 },
  windows: {
    best: { start: '04:00', end: '06:00', averageAqi: 80, averagePm25: 40 },
    worst: { start: '18:00', end: '20:00', averageAqi: 260, averagePm25: 130 },
  },
  profile: {
    adults: 2,
    children: 1,
    elderly: 0,
    outdoorWorker: false,
    vulnerable: true,
    commute: 'Metro',
    budget: 'Under ₹1,500',
    hasPurifier: false,
    roomAreaSqFt: 180,
  },
  deterministicActions: [
    { title: 'Keep windows closed', category: 'morning', action: 'Close windows until the cleaner window.', suggestedTime: '06:00' },
  ],
}

function request(overrides: Record<string, unknown> = {}, ip = '10.1.0.1', method = 'POST') {
  return new Request('https://vayu.test/api/plan', {
    method,
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: method === 'GET' ? undefined : JSON.stringify({ ...body, ...overrides }),
  })
}

beforeEach(() => {
  clearRateLimits()
  delete process.env.GEMINI_API_KEY
  generateContent.mockReset()
})

afterEach(() => {
  delete process.env.GEMINI_API_KEY
})

describe('POST /api/plan', () => {
  it('returns an unavailable brief when Gemini is not configured', async () => {
    const response = await handler(request())
    expect(response.status).toBe(200)
    const data = (await response.json()) as { source: string; sections: unknown[]; reason: string }
    expect(data.source).toBe('unavailable')
    expect(data.sections).toEqual([])
    expect(data.reason).toContain('deterministic')
  })

  it('rejects invalid requests and non-POST methods', async () => {
    expect((await handler(request({}, '10.1.0.2', 'GET'))).status).toBe(405)
    expect((await handler(request({ location: { city: 'Delhi' } }, '10.1.0.3'))).status).toBe(400)

    const malformed = new Request('https://vayu.test/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.1.0.4' },
      body: 'not json',
    })
    expect((await handler(malformed)).status).toBe(400)
  })

  it('rate limits plan generation', async () => {
    let status = 200
    for (let index = 0; index < 11; index += 1) {
      status = (await handler(request({}, '10.1.0.5'))).status
    }
    expect(status).toBe(429)
  })

  it('returns a validated brief and constrains section titles in the prompt', async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    generateContent.mockResolvedValue({
      text: JSON.stringify({
        greeting: 'A calm, practical day ahead.',
        sections: [
          { title: 'Morning routine', guidance: 'Keep windows closed until the cleaner window at 04:00–06:00.' },
          { title: 'Commute', guidance: 'Metro avoids solo-car emissions; leave before the evening peak.' },
        ],
        sources: ['CAMS', 'CPCB'],
      }),
    })

    const response = await handler(request({}, '10.1.0.6'))
    const data = (await response.json()) as {
      source: string
      greeting: string
      sections: { title: string; guidance: string }[]
      sources: string[]
    }
    expect(data.source).toBe('gemini')
    expect(data.greeting).toContain('practical')
    expect(data.sections).toHaveLength(2)
    expect(data.sources).toEqual(['CAMS', 'CPCB'])

    const call = generateContent.mock.calls[0]![0] as { contents: string; config: { maxOutputTokens: number } }
    expect(call.contents).toContain('Do not contradict these actions')
    expect(call.contents).toContain('Keep windows closed')
    expect(call.config.maxOutputTokens).toBe(900)
  })

  it('clamps an over-long greeting instead of discarding a valid brief', async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    // The live model routinely returns ~180 characters here, which used to fail
    // validation and throw away eight otherwise-valid sections.
    const longGreeting =
      'Namaste. As your environmental-health planner, I have tailored these practical steps for your household in New Delhi given the current poor air quality and the sensitivity of the people who live with you today.'
    expect(longGreeting.length).toBeGreaterThan(160)

    generateContent.mockResolvedValue({
      text: JSON.stringify({
        greeting: longGreeting,
        sections: [
          { title: 'Morning routine', guidance: 'Ventilate only during the cleaner window, then close up.' },
        ],
        sources: ['CPCB'],
      }),
    })

    const data = (await (await handler(request({}, '10.1.0.10'))).json()) as {
      source: string
      greeting: string
      sections: unknown[]
    }
    expect(data.source).toBe('gemini')
    expect(data.sections).toHaveLength(1)
    expect(data.greeting.length).toBeLessThanOrEqual(160)
    expect(data.greeting.endsWith(' ')).toBe(false)
  })

  it('rejects invented section titles and falls back without exposing provider details', async () => {
    process.env.GEMINI_API_KEY = 'test-key'

    generateContent.mockResolvedValue({
      text: JSON.stringify({
        greeting: 'hi',
        sections: [{ title: 'Buy ozone generators', guidance: 'Recommended for every household today.' }],
      }),
    })
    const invented = (await (await handler(request({}, '10.1.0.7'))).json()) as { source: string; reason: string }
    expect(invented.source).toBe('unavailable')
    expect(invented.reason).toContain('invalid brief')

    generateContent.mockResolvedValue({ text: '' })
    const empty = (await (await handler(request({}, '10.1.0.8'))).json()) as { source: string; reason: string }
    expect(empty.reason).toContain('empty brief')

    generateContent.mockRejectedValue(new Error('network failure'))
    const failed = (await (await handler(request({}, '10.1.0.9'))).json()) as { source: string; reason: string }
    expect(failed.reason).toContain('temporarily unavailable')
  })
})

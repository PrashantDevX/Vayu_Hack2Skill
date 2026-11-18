import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestAiBrief } from './planService'
import type { PlanRequest } from './planService'
import { DEFAULT_PROFILE } from '../constants/aqi'

const request: PlanRequest = {
  context: {
    city: 'New Delhi',
    aqi: 200,
    category: 'Moderate',
    pm25: 90,
    bestWindow: '04:00–06:00',
    worstWindow: '18:00–20:00',
    profile: DEFAULT_PROFILE,
  },
  profile: DEFAULT_PROFILE,
  planner: {
    recommendations: [],
    bestWindow: { start: '04:00', end: '06:00', averageAqi: 80, averagePm25: 40 },
    worstWindow: { start: '18:00', end: '20:00', averageAqi: 260, averagePm25: 130 },
    generatedAt: '2026-11-18T10:00:00.000Z',
    contextSummary: 'Context',
  },
}

afterEach(() => vi.unstubAllGlobals())

describe('plan client', () => {
  it('accepts a validated AI brief', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            source: 'gemini',
            greeting: 'A short brief for today.',
            sections: [{ title: 'Commute', guidance: 'Use the cleaner forecast window and avoid busy roads.' }],
            sources: ['CAMS'],
          }),
          { status: 200 },
        ),
      ),
    )
    const brief = await requestAiBrief(request)
    expect(brief.source).toBe('gemini')
    expect(brief.sections).toHaveLength(1)
    const init = vi.mocked(fetch).mock.calls[0]![1] as RequestInit
    const body = JSON.parse(String(init.body))
    expect(body.profile).not.toHaveProperty('name')
    expect(body.deterministicActions).toEqual([])
  })

  it('returns an unavailable brief without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })))
    const failed = await requestAiBrief(request)
    expect(failed.source).toBe('unavailable')
    expect(failed.reason).toContain('deterministic plan remains active')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ source: 'gemini', sections: [] }), { status: 200 })),
    )
    const empty = await requestAiBrief(request)
    expect(empty.source).toBe('unavailable')
  })
})

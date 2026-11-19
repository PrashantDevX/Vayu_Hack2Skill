import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkRateLimit, clearRateLimits, clientKey } from './rateLimit'

beforeEach(() => clearRateLimits())
afterEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  vi.unstubAllGlobals()
})

describe('in-memory rate limit', () => {
  it('allows up to the limit and then blocks with a retry window', async () => {
    const now = 1_000
    expect((await checkRateLimit('a', 2, 60_000, now)).allowed).toBe(true)
    expect((await checkRateLimit('a', 2, 60_000, now + 1)).allowed).toBe(true)
    const blocked = await checkRateLimit('a', 2, 60_000, now + 2)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('resets after the window and isolates keys', async () => {
    expect((await checkRateLimit('a', 1, 1_000, 0)).allowed).toBe(true)
    expect((await checkRateLimit('a', 1, 1_000, 500)).allowed).toBe(false)
    expect((await checkRateLimit('a', 1, 1_000, 1_001)).allowed).toBe(true)
    expect((await checkRateLimit('b', 1, 1_000, 1_001)).allowed).toBe(true)
  })

  it('derives a client key from forwarded headers', () => {
    expect(clientKey(new Request('https://example.test', { headers: { 'x-vercel-forwarded-for': '1.2.3.4, 5.6.7.8' } }))).toBe('1.2.3.4')
    expect(clientKey(new Request('https://example.test', { headers: { 'x-forwarded-for': '9.9.9.9' } }))).toBe('unknown')
    expect(clientKey(new Request('https://example.test', { headers: { 'x-real-ip': '9.9.9.9' } }))).toBe('unknown')
    expect(clientKey(new Request('https://example.test'))).toBe('unknown')
  })

  it('uses shared Redis counters when configured and falls back locally on provider failure', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: [0, 0, 17] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const shared = await checkRateLimit('chat:client', 20)
    expect(shared).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 17 })
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as unknown[]
    expect(sent[0]).toBe('EVAL')
    expect(String(sent[3])).not.toContain('client')

    fetchMock.mockRejectedValueOnce(new Error('unavailable'))
    expect((await checkRateLimit('local-fallback', 1, 60_000, 100)).allowed).toBe(true)
    expect((await checkRateLimit('local-fallback', 1, 60_000, 101)).allowed).toBe(false)
  })

  it('evicts expired buckets after the map grows beyond its safety threshold', async () => {
    for (let index = 0; index < 2_001; index += 1) {
      expect((await checkRateLimit(`expired-${index}`, 1, 1, 0)).allowed).toBe(true)
    }
    expect((await checkRateLimit('trigger-cleanup', 1, 1, 2)).allowed).toBe(true)
    expect((await checkRateLimit('fresh-client', 1, 1, 2)).remaining).toBe(0)
  })
})

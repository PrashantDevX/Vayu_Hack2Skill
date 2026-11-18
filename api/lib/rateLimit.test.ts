import { beforeEach, describe, expect, it } from 'vitest'
import { checkRateLimit, clearRateLimits, clientKey } from './rateLimit'

beforeEach(() => clearRateLimits())

describe('in-memory rate limit', () => {
  it('allows up to the limit and then blocks with a retry window', () => {
    const now = 1_000
    expect(checkRateLimit('a', 2, 60_000, now).allowed).toBe(true)
    expect(checkRateLimit('a', 2, 60_000, now + 1).allowed).toBe(true)
    const blocked = checkRateLimit('a', 2, 60_000, now + 2)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('resets after the window and isolates keys', () => {
    expect(checkRateLimit('a', 1, 1_000, 0).allowed).toBe(true)
    expect(checkRateLimit('a', 1, 1_000, 500).allowed).toBe(false)
    expect(checkRateLimit('a', 1, 1_000, 1_001).allowed).toBe(true)
    expect(checkRateLimit('b', 1, 1_000, 1_001).allowed).toBe(true)
  })

  it('derives a client key from forwarded headers', () => {
    expect(clientKey(new Request('https://example.test', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } }))).toBe('1.2.3.4')
    expect(clientKey(new Request('https://example.test', { headers: { 'x-real-ip': '9.9.9.9' } }))).toBe('9.9.9.9')
    expect(clientKey(new Request('https://example.test'))).toBe('unknown')
  })
})

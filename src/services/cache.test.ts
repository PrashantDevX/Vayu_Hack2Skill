import { beforeEach, describe, expect, it } from 'vitest'
import { cacheClear, cacheDelete, cacheGet, cacheSet, cacheSize, coordinateKey } from './cache'

beforeEach(() => cacheClear())

describe('service cache', () => {
  it('returns unexpired entries and expires them deterministically', () => {
    cacheSet('air', { aqi: 120 }, 10_000, 1_000)
    expect(cacheGet<{ aqi: number }>('air', 5_000)?.value.aqi).toBe(120)
    expect(cacheGet('air', 11_000)).toBeNull()
    expect(cacheSize()).toBe(0)
  })

  it('records the original fetch time for staleness labels', () => {
    const entry = cacheSet('air', 1, 5_000, 2_000)
    expect(entry.fetchedAt).toBe(2_000)
    expect(cacheGet('air', 2_500)?.fetchedAt).toBe(2_000)
  })

  it('supports deletion and key quantization', () => {
    cacheSet('one', 1, 1_000)
    cacheDelete('one')
    expect(cacheGet('one')).toBeNull()
    expect(coordinateKey(28.61394, 77.20901)).toBe('28.61,77.21')
  })
})

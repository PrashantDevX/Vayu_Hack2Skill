import { describe, expect, it } from 'vitest'
import { createCache, coordinateKey } from './cache'

describe('service cache', () => {
  it('returns unexpired entries and expires them deterministically', () => {
    const cache = createCache<{ aqi: number }>()
    cache.set('air', { aqi: 120 }, 10_000, 1_000)
    expect(cache.get('air', 5_000)?.value.aqi).toBe(120)
    expect(cache.get('air', 11_000)).toBeNull()
    expect(cache.size).toBe(0)
  })

  it('records the original fetch time for staleness labels', () => {
    const cache = createCache<number>()
    const entry = cache.set('air', 1, 5_000, 2_000)
    expect(entry.fetchedAt).toBe(2_000)
    expect(cache.get('air', 2_500)?.fetchedAt).toBe(2_000)
  })

  it('supports deletion and key quantization', () => {
    const cache = createCache<number>()
    cache.set('one', 1, 1_000)
    cache.delete('one')
    expect(cache.get('one')).toBeNull()
    expect(coordinateKey(28.61394, 77.20901)).toBe('28.61,77.21')
  })

  it('keeps caches isolated by their value type', () => {
    const numbers = createCache<number>()
    const labels = createCache<string>()
    numbers.set('shared-key', 42, 1_000)
    labels.set('shared-key', 'current', 1_000)
    expect(numbers.get('shared-key')?.value).toBe(42)
    expect(labels.get('shared-key')?.value).toBe('current')
  })
})

export interface CacheEntry<T> {
  value: T
  fetchedAt: number
  expiresAt: number
}

export interface Cache<T> {
  get(key: string, now?: number): CacheEntry<T> | null
  set(key: string, value: T, ttlMs: number, now?: number): CacheEntry<T>
  delete(key: string): void
  clear(): void
  readonly size: number
}

/** Each consumer owns a cache with one value type, so reads cannot assert an unrelated type. */
export function createCache<T>(): Cache<T> {
  const entries = new Map<string, CacheEntry<T>>()

  return {
    get(key, now = Date.now()) {
      const entry = entries.get(key)
      if (!entry) return null
      if (entry.expiresAt <= now) {
        entries.delete(key)
        return null
      }
      return entry
    },

    set(key, value, ttlMs, now = Date.now()) {
      const entry: CacheEntry<T> = {
        value,
        fetchedAt: now,
        expiresAt: now + Math.max(0, ttlMs),
      }
      entries.set(key, entry)
      return entry
    },

    delete(key) {
      entries.delete(key)
    },

    clear() {
      entries.clear()
    },

    get size() {
      return entries.size
    },
  }
}

export function coordinateKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`
}

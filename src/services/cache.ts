export interface CacheEntry<T> {
  value: T
  fetchedAt: number
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

export function cacheGet<T>(key: string, now: number = Date.now()): CacheEntry<T> | null {
  const entry = store.get(key)
  if (!entry) return null
  if (entry.expiresAt <= now) {
    store.delete(key)
    return null
  }
  return entry as CacheEntry<T>
}

export function cacheSet<T>(
  key: string,
  value: T,
  ttlMs: number,
  now: number = Date.now(),
): CacheEntry<T> {
  const entry: CacheEntry<T> = {
    value,
    fetchedAt: now,
    expiresAt: now + Math.max(0, ttlMs),
  }
  store.set(key, entry)
  return entry
}

export function cacheDelete(key: string): void {
  store.delete(key)
}

export function cacheClear(): void {
  store.clear()
}

export function cacheSize(): number {
  return store.size
}

export function coordinateKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`
}

import { createHash } from 'node:crypto'

const buckets = new Map<string, { count: number; resetAt: number }>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

function checkLocalRateLimit(key: string, limit: number, windowMs: number, now: number): RateLimitResult {
  if (buckets.size >= 2_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey)
    }
    if (buckets.size >= 2_000 && !buckets.has(key)) {
      const oldest = buckets.keys().next().value as string | undefined
      if (oldest) buckets.delete(oldest)
    }
  }

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 }
  }

  existing.count += 1
  if (existing.count > limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) }
  }
  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0 }
}

async function checkSharedRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const redisKey = `vayu:ratelimit:${createHash('sha256').update(key).digest('hex')}`
  const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); end; local ttl=redis.call('PTTL',KEYS[1]); local lim=tonumber(ARGV[2]); return {n<=lim and 1 or 0, math.max(0,lim-n), math.ceil(math.max(ttl,0)/1000)}"
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['EVAL', script, '1', redisKey, String(windowMs), String(limit)]),
      signal: AbortSignal.timeout(1_500),
    })
    if (!response.ok) return null
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object' || !('result' in payload) || !Array.isArray(payload.result)) return null
    const [allowed, remaining, retryAfterSeconds] = payload.result.map(Number)
    if (![allowed, remaining, retryAfterSeconds].every(Number.isFinite)) return null
    return { allowed: allowed === 1, remaining: Math.max(0, remaining), retryAfterSeconds: allowed === 1 ? 0 : Math.max(1, retryAfterSeconds) }
  } catch {
    return null
  }
}

export async function checkRateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const shared = await checkSharedRateLimit(key, limit, windowMs)
  return shared ?? checkLocalRateLimit(key, limit, windowMs, now)
}

export function clientKey(request: Request): string {
  // Vercel overwrites this platform header; user-controlled forwarding headers
  // are not an identity source for an abuse-control boundary.
  const forwarded = request.headers.get('x-vercel-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return 'unknown'
}

export function clearRateLimits(): void {
  buckets.clear()
}

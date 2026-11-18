/**
 * Shared Gemini call policy for `api/chat` and `api/plan`.
 *
 * The live model intermittently answers `503 UNAVAILABLE` ("This model is
 * currently experiencing high demand"). Those rejections arrive in ~2 s, while
 * a successful brief takes ~9 s, so one retry costs little and turns a visible
 * "AI unavailable" state into a working answer. The retry is bounded by the
 * same overall deadline as before, so a slow request cannot exceed the
 * function's `maxDuration`.
 *
 * The AI is never authoritative: if every attempt fails, callers fall back to
 * their deterministic response exactly as before.
 */

const DEFAULT_TIMEOUT_MS = 18_000
const DEFAULT_RETRY_DELAY_MS = 300

/** Statuses Google returns for overload and quota pressure, not for bad input. */
const TRANSIENT_STATUS = [
  'UNAVAILABLE',
  'RESOURCE_EXHAUSTED',
  'INTERNAL',
  'DEADLINE_EXCEEDED',
  'OVERLOADED',
]

const TRANSIENT_CODES = [429, 500, 502, 503, 504]

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('AI request timed out')), ms)
    promise.then(
      value => {
        clearTimeout(timeout)
        resolve(value)
      },
      error => {
        clearTimeout(timeout)
        reject(error)
      },
    )
  })
}

/**
 * A transient failure is an upstream capacity problem or a quota/rate signal.
 * Anything else (invalid argument, permission denied, unknown model) is a real
 * configuration fault and must not be retried.
 */
export function isTransientGeminiError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown }

  if (typeof candidate.status === 'string') {
    const status = candidate.status.toUpperCase()
    if (TRANSIENT_STATUS.includes(status)) return true
  }

  if (typeof candidate.code === 'number' && TRANSIENT_CODES.includes(candidate.code)) return true

  if (typeof candidate.message !== 'string') return false
  const message = candidate.message
  if (TRANSIENT_STATUS.some(status => message.includes(status))) return true

  // The SDK surfaces the provider payload as a JSON string in `message`.
  const code = message.match(/"code"\s*:\s*(\d{3})/)
  return code ? TRANSIENT_CODES.includes(Number(code[1])) : false
}

export interface GeminiCallOptions {
  /** Total attempts, including the first. Defaults to one retry. */
  attempts?: number
  /** Overall deadline shared by every attempt. */
  timeoutMs?: number
  /** Pause between attempts; clamped to the remaining budget. */
  retryDelayMs?: number
}

/**
 * Runs a Gemini request under an overall deadline, retrying once when the
 * provider reports a transient failure. Throws the last error when no attempt
 * succeeds, so callers keep their existing fallback path.
 */
export async function callGemini<T>(
  run: () => Promise<T>,
  options: GeminiCallOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 2)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  const deadline = Date.now() + timeoutMs

  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) break

    try {
      return await withTimeout(run(), remaining)
    } catch (error) {
      lastError = error
      if (attempt === attempts || !isTransientGeminiError(error)) break

      const pause = Math.min(retryDelayMs, Math.max(0, deadline - Date.now()))
      if (pause > 0) await delay(pause)
    }
  }

  throw lastError ?? new Error('AI request timed out')
}

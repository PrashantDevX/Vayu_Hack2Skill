/* @vitest-environment node */
import { describe, expect, it, vi } from 'vitest'
import { callGemini, isTransientGeminiError } from './gemini'

function overloadError(): Error {
  // Shape observed from the live API through @google/genai: the provider payload
  // arrives as a JSON string in `message`.
  return new Error(
    JSON.stringify({
      error: {
        code: 503,
        message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary.',
        status: 'UNAVAILABLE',
      },
    }),
  )
}

describe('isTransientGeminiError', () => {
  it('treats overload and quota failures as transient', () => {
    expect(isTransientGeminiError(overloadError())).toBe(true)
    expect(isTransientGeminiError({ status: 'RESOURCE_EXHAUSTED' })).toBe(true)
    expect(isTransientGeminiError({ code: 429 })).toBe(true)
    expect(isTransientGeminiError({ message: '"code": 504' })).toBe(true)
  })

  it('does not retry real configuration faults', () => {
    expect(
      isTransientGeminiError(
        new Error(JSON.stringify({ error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Bad key' } })),
      ),
    ).toBe(false)
    expect(isTransientGeminiError({ status: 'PERMISSION_DENIED' })).toBe(false)
    expect(isTransientGeminiError(new Error('unknown model'))).toBe(false)
    expect(isTransientGeminiError(null)).toBe(false)
    expect(isTransientGeminiError('boom')).toBe(false)
  })
})

describe('callGemini', () => {
  it('returns the first result without retrying', async () => {
    const run = vi.fn().mockResolvedValue('ok')
    await expect(callGemini(run)).resolves.toBe('ok')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('retries once after a transient failure and succeeds', async () => {
    const run = vi.fn().mockRejectedValueOnce(overloadError()).mockResolvedValue('second-attempt')
    await expect(callGemini(run, { retryDelayMs: 0 })).resolves.toBe('second-attempt')
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('does not retry a non-transient failure', async () => {
    const run = vi.fn().mockRejectedValue(new Error(JSON.stringify({ error: { code: 400, status: 'INVALID_ARGUMENT' } })))
    await expect(callGemini(run, { retryDelayMs: 0 })).rejects.toThrow('INVALID_ARGUMENT')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('throws the last error when every attempt is transient', async () => {
    const run = vi.fn().mockRejectedValue(overloadError())
    await expect(callGemini(run, { retryDelayMs: 0 })).rejects.toThrow('high demand')
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('times a hanging attempt out within the deadline', async () => {
    const run = vi.fn().mockReturnValue(new Promise(() => {}))
    await expect(callGemini(run, { attempts: 1, timeoutMs: 20 })).rejects.toThrow('timed out')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('honours an attempt cap of one', async () => {
    const run = vi.fn().mockRejectedValue(overloadError())
    await expect(callGemini(run, { attempts: 1, retryDelayMs: 0 })).rejects.toThrow('high demand')
    expect(run).toHaveBeenCalledTimes(1)
  })
})

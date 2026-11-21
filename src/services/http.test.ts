import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchJson, HttpError } from './http'

function response(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchJson', () => {
  it('parses a successful JSON response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('{"ok":true}'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchJson('https://example.test')).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry a 4xx response and surfaces the status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('{"error":"no"}', 404))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchJson('https://example.test', { retries: 1 })).rejects.toBeInstanceOf(HttpError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid JSON and empty responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('not json')))
    await expect(fetchJson('https://example.test', { retries: 0 })).rejects.toThrow('invalid JSON')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('')))
    await expect(fetchJson('https://example.test', { retries: 0 })).rejects.toThrow('empty response')
  })

  it('reports a timeout when the provider does not answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const error = new Error('Aborted')
            error.name = 'AbortError'
            reject(error)
          })
        })
      }),
    )
    await expect(fetchJson('https://example.test', { timeoutMs: 10, retries: 0 })).rejects.toThrow('timed out')
  })

  it('retries a server error and then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response('{"error":true}', 500))
      .mockResolvedValueOnce(response('{"ok":true}'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchJson('https://example.test', { retries: 1 })).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

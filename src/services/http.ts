export class HttpError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export interface FetchJsonOptions {
  timeoutMs?: number
  retries?: number
  signal?: AbortSignal
  headers?: Record<string, string>
  method?: 'GET' | 'POST'
  body?: unknown
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function fetchJson(url: string, options: FetchJsonOptions = {}): Promise<unknown> {
  const timeoutMs = options.timeoutMs ?? 9_000
  const retries = options.retries ?? 1
  let lastError: unknown = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const externalAbort = () => controller.abort()
    options.signal?.addEventListener('abort', externalAbort)

    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...options.headers,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new HttpError(`Request failed with status ${response.status}`, response.status)
      }

      const text = await response.text()
      if (!text) throw new Error('Provider returned an empty response')
      try {
        const payload: unknown = JSON.parse(text)
        return payload
      } catch {
        throw new Error('Provider returned invalid JSON')
      }
    } catch (error) {
      lastError = error
      const status = error instanceof HttpError ? error.status : null
      const retryable = status === null || status >= 500
      if (!retryable || attempt === retries || options.signal?.aborted) break
      await delay(300 * 2 ** attempt)
    } finally {
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', externalAbort)
    }
  }

  if (lastError instanceof HttpError) throw lastError
  if (lastError instanceof Error) {
    if (lastError.name === 'AbortError') throw new Error('Provider request timed out')
    throw lastError
  }
  throw new Error('Provider request failed')
}

/* @vitest-environment node */
import { describe, expect, it } from 'vitest'
import type { NodeIncomingMessage, NodeServerResponse } from './adapter'
import { withVercelRuntime } from './adapter'

type Listener = (chunk?: unknown) => void

/**
 * Minimal stand-in for Node's IncomingMessage. Vercel hands the handler a real
 * readable stream; this emits its chunks on the next tick so the adapter can
 * attach listeners first.
 */
class FakeNodeRequest {
  method: string
  url: string
  headers: Record<string, string | string[] | undefined>
  private readonly chunks: unknown[]
  private readonly fail: boolean
  private readonly listeners = new Map<string, Listener[]>()
  private scheduled = false

  constructor(init: {
    method?: string
    url: string
    headers?: Record<string, string | string[] | undefined>
    chunks?: unknown[]
    fail?: boolean
  }) {
    this.method = init.method ?? 'GET'
    this.url = init.url
    this.headers = init.headers ?? {}
    this.chunks = init.chunks ?? []
    this.fail = init.fail ?? false
  }

  on(event: string, listener: Listener): void {
    const existing = this.listeners.get(event) ?? []
    existing.push(listener)
    this.listeners.set(event, existing)
    if (!this.scheduled) {
      this.scheduled = true
      setTimeout(() => this.flush(), 0)
    }
  }

  private emit(event: string, chunk?: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) listener(chunk)
  }

  private flush(): void {
    if (this.fail) {
      this.emit('error', new Error('stream failed'))
      return
    }
    for (const chunk of this.chunks) this.emit('data', chunk)
    this.emit('end')
  }
}

class FakeNodeResponse {
  statusCode = 200
  readonly headers = new Map<string, string | string[]>()
  body: Uint8Array | string | undefined

  setHeader(name: string, value: string | string[]): void {
    this.headers.set(name.toLowerCase(), value)
  }

  end(body?: Uint8Array | string): void {
    this.body = body
  }
}

function decode(body: Uint8Array | string | undefined): string {
  if (body === undefined) return ''
  return typeof body === 'string' ? body : new TextDecoder().decode(body)
}

function asNode(req: FakeNodeRequest): NodeIncomingMessage {
  return req as unknown as NodeIncomingMessage
}

function asRes(res: FakeNodeResponse): NodeServerResponse {
  return res as unknown as NodeServerResponse
}

describe('withVercelRuntime', () => {
  it('passes a Fetch Request straight through so handler tests stay meaningful', async () => {
    const wrapped = withVercelRuntime(async request =>
      Response.json({ url: request.url, method: request.method }),
    )

    const response = await wrapped(new Request('https://vayu.test/api/x?a=1'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ url: 'https://vayu.test/api/x?a=1', method: 'GET' })
  })

  it('rebuilds the URL from the host header and forwards method, headers and body', async () => {
    const wrapped = withVercelRuntime(async request => {
      const body = await request.text()
      return Response.json(
        {
          url: request.url,
          method: request.method,
          forwarded: request.headers.get('x-forwarded-for'),
          body,
        },
        { status: 201, headers: { 'x-custom': 'yes' } },
      )
    })

    const req = new FakeNodeRequest({
      method: 'POST',
      url: '/api/chat?mode=quick',
      headers: { host: 'vayu-wheat.vercel.app', 'x-forwarded-for': '1.2.3.4' },
      chunks: [new TextEncoder().encode('{"message":"hi"}')],
    })
    const res = new FakeNodeResponse()

    await wrapped(asNode(req), asRes(res))

    expect(res.statusCode).toBe(201)
    expect(res.headers.get('x-custom')).toBe('yes')
    expect(JSON.parse(decode(res.body))).toEqual({
      url: 'https://vayu-wheat.vercel.app/api/chat?mode=quick',
      method: 'POST',
      forwarded: '1.2.3.4',
      body: '{"message":"hi"}',
    })
  })

  it('keeps an absolute request URL untouched', async () => {
    const wrapped = withVercelRuntime(async request => Response.json({ url: request.url }))
    const req = new FakeNodeRequest({ url: 'https://example.test/api/aqi?city=Delhi' })
    const res = new FakeNodeResponse()

    await wrapped(asNode(req), asRes(res))

    expect(JSON.parse(decode(res.body)).url).toBe('https://example.test/api/aqi?city=Delhi')
  })

  it('falls back to localhost when the host header is missing', async () => {
    const wrapped = withVercelRuntime(async request => Response.json({ url: request.url }))
    const req = new FakeNodeRequest({ url: '/api/health' })
    const res = new FakeNodeResponse()

    await wrapped(asNode(req), asRes(res))

    expect(JSON.parse(decode(res.body)).url).toBe('https://localhost/api/health')
  })

  it('joins repeated header values and ignores undefined ones', async () => {
    const wrapped = withVercelRuntime(async request =>
      Response.json({
        forwarded: request.headers.get('x-forwarded-for'),
        absent: request.headers.get('x-absent'),
      }),
    )
    const req = new FakeNodeRequest({
      url: '/api/aqi',
      headers: { 'x-forwarded-for': ['10.0.0.1', '10.0.0.2'], 'x-absent': undefined },
    })
    const res = new FakeNodeResponse()

    await wrapped(asNode(req), asRes(res))

    expect(JSON.parse(decode(res.body))).toEqual({
      forwarded: '10.0.0.1, 10.0.0.2',
      absent: null,
    })
  })

  it('does not read a body for GET or HEAD', async () => {
    const wrapped = withVercelRuntime(async request =>
      Response.json({ body: await request.text() }),
    )

    for (const method of ['GET', 'HEAD']) {
      const req = new FakeNodeRequest({ method, url: '/api/aqi', chunks: ['ignored'] })
      const res = new FakeNodeResponse()
      await wrapped(asNode(req), asRes(res))
      expect(JSON.parse(decode(res.body))).toEqual({ body: '' })
    }
  })

  it('skips non-byte chunks and omits an empty body', async () => {
    const wrapped = withVercelRuntime(async request => {
      const text = await request.text()
      // A 204 must carry no body; the adapter should not call res.end with bytes.
      return text === '' ? new Response(null, { status: 204 }) : new Response(text)
    })

    const req = new FakeNodeRequest({
      method: 'POST',
      url: '/api/plan',
      // A string chunk is not a Uint8Array, so it must not become request data.
      chunks: ['not-bytes'],
    })
    const res = new FakeNodeResponse()

    await wrapped(asNode(req), asRes(res))

    expect(res.statusCode).toBe(204)
    expect(res.body).toBeUndefined()
  })

  it('sets every Set-Cookie header rather than merging them', async () => {
    const wrapped = withVercelRuntime(async () => {
      const headers = new Headers()
      headers.append('set-cookie', 'a=1; Path=/')
      headers.append('set-cookie', 'b=2; Path=/')
      return new Response('ok', { headers })
    })

    const req = new FakeNodeRequest({ url: '/api/health' })
    const res = new FakeNodeResponse()

    await wrapped(asNode(req), asRes(res))

    const cookie = res.headers.get('set-cookie')
    const text = Array.isArray(cookie) ? cookie.join('; ') : String(cookie)
    expect(text).toContain('a=1')
    expect(text).toContain('b=2')
  })

  it('rejects when the request stream errors', async () => {
    const wrapped = withVercelRuntime(async () => Response.json({ ok: true }))
    const req = new FakeNodeRequest({ method: 'POST', url: '/api/chat', fail: true })
    const res = new FakeNodeResponse()

    await expect(wrapped(asNode(req), asRes(res))).rejects.toThrow('stream failed')
  })

  it('returns an explicit error when invoked without a response object', async () => {
    const wrapped = withVercelRuntime(async () => Response.json({ ok: true }))
    const result = await wrapped(asNode(new FakeNodeRequest({ url: '/api/x' })))
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(500)
    expect(await (result as Response).json()).toEqual({ error: 'Unsupported invocation' })
  })
})

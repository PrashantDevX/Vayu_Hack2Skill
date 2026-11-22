/**
 * Bridge between the Fetch-style handlers in `api/` and Vercel's Node.js runtime.
 *
 * The handlers are written against the standard Fetch API (`Request` in,
 * `Response` out) so they can be unit-tested by passing a plain `Request`.
 * Vercel's `nodejs` runtime, however, invokes the default export as
 * `(req, res)` with Node's `IncomingMessage` / `ServerResponse`.
 *
 * Without this adapter the deployed function throws
 * `TypeError: request.headers.get is not a function`, because it receives a
 * Node request. Accepting both conventions keeps the tests meaningful and the
 * deployment working from the same source.
 */

type WebHandler = (request: Request) => Promise<Response> | Response
const MAX_ADAPTER_BODY_BYTES = 16_000
const BODY_TOO_LARGE = Symbol('body-too-large')

interface NodeHeaders {
  [name: string]: string | string[] | undefined
}

/** The subset of `IncomingMessage` this adapter reads. */
export interface NodeIncomingMessage {
  method?: string
  url?: string
  headers?: NodeHeaders
  on: (event: 'data' | 'end' | 'error', listener: (chunk?: unknown) => void) => void
  resume?: () => unknown
}

/** The subset of `ServerResponse` this adapter writes. */
export interface NodeServerResponse {
  statusCode: number
  setHeader: (name: string, value: string | string[]) => void
  end: (body?: Uint8Array | string) => void
}

export interface VercelHandler {
  /** Unit-test / Fetch path: hand it a `Request`, get a `Response`. */
  (request: Request): Promise<Response>
  /** Vercel Node path. */
  (request: NodeIncomingMessage, response?: NodeServerResponse): Promise<Response | void>
}

function isFetchRequest(value: unknown): value is Request {
  return typeof Request !== 'undefined' && value instanceof Request
}

function nodeHeader(headers: NodeHeaders | undefined, name: string): string | undefined {
  if (!headers) return undefined
  const wanted = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== wanted || value === undefined) continue
    return Array.isArray(value) ? value[0] : value
  }
  return undefined
}

function toFetchHeaders(source: NodeHeaders | undefined): Headers {
  const headers = new Headers()
  if (!source) return headers
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue
    headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }
  return headers
}

/**
 * Rebuilds the absolute URL. Vercel supplies a path such as
 * `/api/aqi?city=Delhi`, so the host header supplies the origin.
 */
function toFetchUrl(req: NodeIncomingMessage): URL {
  const raw = req.url ?? '/'
  if (/^https?:\/\//i.test(raw)) return new URL(raw)
  const host = nodeHeader(req.headers, 'host') ?? 'localhost'
  return new URL(raw, `https://${host}`)
}

async function readBody(
  req: NodeIncomingMessage,
): Promise<Uint8Array | null | typeof BODY_TOO_LARGE> {
  const method = (req.method ?? 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') return null
  const declaredLength = Number(nodeHeader(req.headers, 'content-length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ADAPTER_BODY_BYTES) {
    // Let Node discard the unread bytes so the connection does not remain
    // blocked behind a request body that this adapter will never consume.
    req.resume?.()
    return BODY_TOO_LARGE
  }

  const chunks: Uint8Array[] = []
  let total = 0
  let tooLarge = false
  await new Promise<void>((resolve, reject) => {
    req.on('data', chunk => {
      if (tooLarge || !(chunk instanceof Uint8Array)) return
      total += chunk.byteLength
      if (total > MAX_ADAPTER_BODY_BYTES) {
        tooLarge = true
        chunks.length = 0
        return
      }
      chunks.push(new Uint8Array(chunk))
    })
    req.on('end', () => resolve())
    req.on('error', error => reject(error))
  })

  if (tooLarge) return BODY_TOO_LARGE
  if (total === 0) return null
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

function setCookies(headers: Headers): string[] {
  const withCookies = headers as Headers & { getSetCookie?: () => string[] }
  return typeof withCookies.getSetCookie === 'function' ? withCookies.getSetCookie() : []
}

async function writeResponse(res: NodeServerResponse, response: Response): Promise<void> {
  response.headers.forEach((value, key) => {
    // Multiple Set-Cookie headers are set separately below.
    if (key.toLowerCase() !== 'set-cookie') res.setHeader(key, value)
  })
  const cookies = setCookies(response.headers)
  if (cookies.length > 0) res.setHeader('set-cookie', cookies)

  const body = new Uint8Array(await response.arrayBuffer())
  res.statusCode = response.status
  res.end(body.byteLength > 0 ? body : undefined)
}

export function withVercelRuntime(handler: WebHandler): VercelHandler {
  const run = async (
    request: Request | NodeIncomingMessage,
    response?: NodeServerResponse,
  ): Promise<Response | void> => {
    if (isFetchRequest(request)) return handler(request)

    if (!response) {
      return Response.json({ error: 'Unsupported invocation' }, { status: 500 })
    }

    const nodeRequest = request
    const body = await readBody(nodeRequest)
    if (body === BODY_TOO_LARGE) {
      await writeResponse(response, Response.json(
        { error: 'Request too large' },
        { status: 413, headers: { 'Cache-Control': 'no-store' } },
      ))
      return
    }
    const init: RequestInit = {
      method: nodeRequest.method ?? 'GET',
      headers: toFetchHeaders(nodeRequest.headers),
    }
    if (body) init.body = body

    const webResponse = await handler(new Request(toFetchUrl(nodeRequest), init))
    await writeResponse(response, webResponse)
  }

  // Arity 2 is what tells Vercel's Node runtime this is a `(req, res)` handler.
  return run as VercelHandler
}

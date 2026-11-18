import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { checkRateLimit, clientKey } from './lib/rateLimit.js'

export const config = { runtime: 'nodejs', maxDuration: 25 }

const windowSchema = z
  .object({
    start: z.string().max(10),
    end: z.string().max(10),
    averageAqi: z.number().nullable(),
    averagePm25: z.number().nullable(),
  })
  .nullable()

const requestSchema = z.object({
  location: z.object({
    city: z.string().trim().max(80),
    aqi: z.number().min(0).max(500).nullable(),
    category: z.string().max(30).nullable(),
    pm25: z.number().min(0).max(2000).nullable(),
  }),
  windows: z.object({ best: windowSchema, worst: windowSchema }),
  profile: z.object({
    adults: z.number().int().min(0).max(20),
    children: z.number().int().min(0).max(20),
    elderly: z.number().int().min(0).max(20),
    outdoorWorker: z.boolean(),
    vulnerable: z.boolean(),
    commute: z.string().max(30),
    budget: z.string().max(30),
    hasPurifier: z.boolean(),
    roomAreaSqFt: z.number().min(0).max(5000),
  }),
  deterministicActions: z
    .array(
      z.object({
        title: z.string().max(160),
        category: z.string().max(30),
        action: z.string().max(600),
        suggestedTime: z.string().max(80),
      }),
    )
    .max(10),
})

const briefSchema = z.object({
  greeting: z.string().max(160).optional(),
  sections: z
    .array(
      z.object({
        title: z.enum([
          'Morning routine',
          'Commute',
          'Outdoor activity',
          'Indoor environment',
          'School and children',
          'Elderly precautions',
          'Evening routine',
          'Night-time environment',
        ]),
        guidance: z.string().min(10).max(600),
      }),
    )
    .min(1)
    .max(8),
  sources: z.array(z.string().max(300)).max(5).default([]),
})

type PlanBody = z.infer<typeof requestSchema>

function unavailable(reason: string): Response {
  return Response.json(
    { source: 'unavailable', greeting: null, sections: [], sources: [], reason },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      return null
    }
  }
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

function buildPrompt(body: PlanBody): string {
  const actions = body.deterministicActions
    .map((item, index) => `${index + 1}. [${item.category}] ${item.title} — ${item.action} (${item.suggestedTime})`)
    .join('\n')
  return `You are Vayu, an environmental-health planner for an urban household.
Return JSON only: {"greeting": string, "sections": [{"title": one of the eight titles, "guidance": string}], "sources": string[]}.
Section titles must be chosen from: Morning routine, Commute, Outdoor activity, Indoor environment, School and children, Elderly precautions, Evening routine, Night-time environment.
Write 3–6 sections. Each guidance must be 20–350 characters, practical, and explain briefly why. Do not repeat numeric AQI values unless they appear in the context. Do not invent measurements, health benefits, diagnoses, medication or costs. Do not tell the user to ignore medical advice. Never recommend ozone generators or unsafe DIY electrical devices. Do not claim an immediate city AQI change from personal transport changes.
Context:
City: ${body.location.city}
Estimated model AQI: ${body.location.aqi ?? 'unavailable'}
Category: ${body.location.category ?? 'unavailable'}
PM2.5: ${body.location.pm25 ?? 'unavailable'}
Cleaner window: ${body.windows.best ? `${body.windows.best.start}–${body.windows.best.end}` : 'unavailable'}
Higher-pollution window: ${body.windows.worst ? `${body.windows.worst.start}–${body.windows.worst.end}` : 'unavailable'}
Household: ${body.profile.adults} adults, ${body.profile.children} children, ${body.profile.elderly} older adults, outdoor worker: ${body.profile.outdoorWorker ? 'yes' : 'no'}, sensitivity indicated: ${body.profile.vulnerable ? 'yes' : 'no'}
Commute: ${body.profile.commute}
Budget: ${body.profile.budget}
Has purifier: ${body.profile.hasPurifier ? 'yes' : 'no'}
Room area: ${body.profile.roomAreaSqFt} sq ft
Deterministic actions already shown to the user:
${actions || 'none'}
Do not contradict these actions. Explain and prioritize them.`
}

export default async function handler(req: Request): Promise<Response> {
  const limit = checkRateLimit(`plan:${clientKey(req)}`, 10)
  if (!limit.allowed) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST' } })
  }

  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > 16_000) {
    return Response.json({ error: 'Request too large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 })

  if (!process.env.GEMINI_API_KEY) return unavailable('Gemini is not configured; the deterministic plan is active.')

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const result = await withTimeout(
      ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        contents: buildPrompt(parsed.data),
        config: { responseMimeType: 'application/json', maxOutputTokens: 900, temperature: 0.25 },
      }),
      18_000,
    )

    const text = result.text?.trim()
    if (!text) return unavailable('Gemini returned an empty brief.')

    const validated = briefSchema.safeParse(extractJson(text))
    if (!validated.success) return unavailable('Gemini returned an invalid brief.')

    return Response.json(
      { source: 'gemini', greeting: validated.data.greeting ?? null, sections: validated.data.sections, sources: validated.data.sources },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return unavailable('Gemini is temporarily unavailable.')
  }
}

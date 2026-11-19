#!/usr/bin/env node
/**
 * Post-deploy smoke test for the Vayu API functions.
 *
 * Why this exists: a single missing file extension in a shared module took down
 * /api/chat and /api/plan with ERR_MODULE_NOT_FOUND, while all 180 unit tests
 * stayed green. Vitest and Vite both resolve extensionless imports; the Vercel
 * Node runtime does not. The only reliable way to catch that class of failure is
 * to call the deployed function over HTTP.
 *
 * Usage:
 *   node scripts/smoke-api.mjs
 *   node scripts/smoke-api.mjs https://your-preview-url.vercel.app
 *   VAYU_BASE_URL=https://... node scripts/smoke-api.mjs
 *
 * Exit code 0 = every check passed. Exit code 1 = at least one failed.
 * The script never prints an environment variable or an API key.
 */

const base = (process.argv[2] ?? process.env.VAYU_BASE_URL ?? 'https://vayu-wheat.vercel.app').replace(/\/+$/, '')

const results = []
function record(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail: String(detail) })
}

async function call(route, init) {
  const started = Date.now()
  const res = await fetch(`${base}${route}`, init)
  const text = await res.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    body = null
  }
  return { status: res.status, body, text: text.slice(0, 200), ms: Date.now() - started }
}

const chatBody = JSON.stringify({
  message: 'Should we open the windows this evening?',
  location: { city: 'New Delhi', aqi: 180, pm25: 90 },
  preferences: { commute: 'Metro', vulnerable: false, budget: 'Free' },
  forecast: { category: 'Moderate', bestWindow: '14:00', worstWindow: '21:00' },
})

const planBody = JSON.stringify({
  location: { city: 'New Delhi', aqi: 180, pm25: 90 },
  windows: {
    best: { start: '14:00', end: '16:00', averageAqi: 150, averagePm25: 70 },
    worst: { start: '20:00', end: '22:00', averageAqi: 220, averagePm25: 120 },
  },
  profile: { adults: 2, children: 1, elderly: 0, commute: 'Metro', budget: 'Free' },
  deterministicActions: [{ id: 'ventilate-1400', title: 'Ventilate at 14:00' }],
})

const jsonHeaders = { 'Content-Type': 'application/json' }

async function run() {
  try {
    const health = await call('/api/health')
    record('GET /api/health returns 200', health.status === 200, `status=${health.status} body=${health.text}`)
    record('GET /api/health reports a service status', health.body?.status === 'ok', `status=${health.body?.status}`)
    record(
      'GET /api/health exposes booleans, never key values',
      typeof health.body?.geminiConfigured === 'boolean' && typeof health.body?.officialProviderConfigured === 'boolean',
      JSON.stringify(health.body ?? {}),
    )

    const aqi = await call('/api/aqi?city=Delhi')
    record('GET /api/aqi returns 200', aqi.status === 200, `status=${aqi.status} body=${aqi.text}`)
    record('GET /api/aqi returns the documented shape', typeof aqi.body?.available === 'boolean' && Array.isArray(aqi.body?.pollutants), aqi.text)

    const aqiBad = await call('/api/aqi?city=%3Cscript%3Ealert(1)%3C%2Fscript%3E')
    record('GET /api/aqi rejects a malformed city with 400', aqiBad.status === 400, `status=${aqiBad.status} body=${aqiBad.text}`)

    const chat = await call('/api/chat', { method: 'POST', headers: jsonHeaders, body: chatBody })
    record('POST /api/chat returns 200 (not a 500)', chat.status === 200, `status=${chat.status} body=${chat.text}`)
    record(
      'POST /api/chat returns a labelled source',
      chat.body?.source === 'gemini' || chat.body?.source === 'fallback',
      `source=${chat.body?.source}`,
    )
    record('POST /api/chat returns a non-empty answer', typeof chat.body?.answer === 'string' && chat.body.answer.length > 20, `length=${chat.body?.answer?.length ?? 0}`)
    record('POST /api/chat returns server-issued source ids', Array.isArray(chat.body?.sources), JSON.stringify(chat.body?.sources ?? []))

    const chatMethod = await call('/api/chat')
    record('GET /api/chat returns 405 (handler actually runs)', chatMethod.status === 405, `status=${chatMethod.status} body=${chatMethod.text}`)

    const plan = await call('/api/plan', { method: 'POST', headers: jsonHeaders, body: planBody })
    record('POST /api/plan returns 200 (not a 500)', plan.status === 200, `status=${plan.status} body=${plan.text}`)
    record(
      'POST /api/plan returns a labelled source',
      plan.body?.source === 'gemini' || plan.body?.source === 'unavailable',
      `source=${plan.body?.source}`,
    )
    record('POST /api/plan returns a sections array', Array.isArray(plan.body?.sections), `type=${typeof plan.body?.sections}`)

    const planMethod = await call('/api/plan')
    record('GET /api/plan returns 405 (handler actually runs)', planMethod.status === 405, `status=${planMethod.status} body=${planMethod.text}`)
  } catch (error) {
    record('smoke run completed', false, error instanceof Error ? error.message : String(error))
  }

  const width = Math.max(...results.map(r => r.name.length))
  let failed = 0
  console.log(`\nVayu API smoke test against ${base}\n`)
  for (const { name, ok, detail } of results) {
    if (!ok) failed += 1
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(width)}  ${ok ? '' : detail}`)
  }
  console.log(`\n${results.length - failed}/${results.length} checks passed\n`)
  if (failed > 0) process.exitCode = 1
}

run()

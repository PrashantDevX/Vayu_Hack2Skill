# Vayu third remediation sprint results

Run: 2026-11-19 (Asia/Calcutta). Latest Git `main` was clean and aligned with `origin/main` before edits (`a27b948`). No production deployment or browser checks were run. No credentials or provider response containing household data were recorded.

## Automated checks

| Command | Result | Evidence |
|---|---|---|
| `npm test` | PASS | 24 files, 180 tests pass. |
| `npm run test:coverage` | PASS | Statements 94.80% (986/1,040); branches 86.24% (790/916); functions 97.61% (164/168); lines 98.21% (826/841). |
| `npm run typecheck` | PASS | `tsc -b` exit 0. |
| `npm run lint` | PASS | `oxlint` exit 0, zero warnings. |
| `npm run build` | PASS | Production build succeeded; initial JS 407.70 kB / 127.16 kB gzip; AirQuality route chunk 443.30 kB / 124.24 kB gzip. |
| `npm audit` | PASS | Full audit, zero vulnerabilities. |
| `npm run check:providers` | PASS | Gemini `generateContent` replied `OK`; data.gov.in returned 10 Delhi rows after `New Delhi` returned 0. The script masked credential values; this report stores no credential contents or lengths. |

Coverage before this sprint was 85.06% branches (712/837). Current is 86.24% (790/916); coverage scope expanded with new code and tests, so denominator changed. The threshold remains 78% for the repository; the sprint objective of at least 85% is met by the measured report.

## Synthetic fallback evaluation

Twenty local API cases ran without Gemini, covering exercise, purifier budget/premium/CADR, ventilation, children, elderly household, commute, masks, severe pollution, exposure, indoor sources, impact claims, unrelated requests, prompt injection, diagnosis requests and missing AQI. Each case asserted HTTP 200, deterministic `fallback` source, a case-specific expected phrase, absence of selected unsafe claims, and trusted source IDs. All 20 passed. Individual dimension records and explanations are in `docs/synthetic-ai-evaluation.json`.

This is a deterministic fallback contract evaluation. It does not measure live Gemini quality after these code changes. The deployment was not updated or called, and the new guard was not run against 20 live model responses.

## Provider and deployment checks

| Check | Result | Evidence / limit |
|---|---|---|
| Gemini provider credentials/connectivity | PASS | Provider script model listing and `generateContent` request passed. No key value was emitted into this report. |
| data.gov.in CPCB-linked records | PASS | Exact `New Delhi` query returned 0; fallback `Delhi` query returned 10 records, including a station, pollutant/value and timestamp. No API key value was retained. |
| Open-Meteo | Previously verified in second sprint | No direct Open-Meteo probe was part of the configured provider script this run; current `aqiService.ts` was not changed. |
| Deployed `/api/*` and browser flows | NOT RUN | The user instruction limited deployment/browser checks to explicitly authorized runs; no production release or smoke-test authorization was given. |
| axe / Lighthouse | NOT RUN | No authorized deployed/browser session was used. |

## Security and rate-limiter status

- Full dependency audit passed with zero vulnerabilities.
- Chat/plan request schemas reject control-character city/message fields, invalid enum injection, unknown properties, and untrusted browser-submitted `deterministicActions`.
- Measured stream parsing enforces 12 kB chat and 16 kB plan caps, returning 413 on overflow and 400 for malformed JSON.
- Upstash REST fixed-window counters use a hashed client key, endpoint-prefixed counters, atomic Redis `EVAL`, a 1.5 second timeout and local fallback. Unit tests cover the shared command, retry response and fallback. No Upstash credentials or independent serverless instances were available, so distributed enforcement is **UNVERIFIED**.
- Client `x-forwarded-for` and `x-real-ip` headers are ignored; Vercel's managed `x-vercel-forwarded-for` is used. Vercel's documentation says it is identical to its overwritten `x-forwarded-for` header: [Vercel request headers](https://vercel.com/docs/headers/request-headers).
- Git-history secret scanning was not run; no history scanner was configured in the supplied workflow. No secret scan pass is claimed.

## Defect results

| Defect | Before | After | Verification |
|---|---|---|---|
| VAYU-AQI-001 | PM2.5 31 → 52, CO 1.1 → 55, NH3 201 → 50 | PM2.5 31 → 51, CO 1.1 → 51, NH3 201 → 51 | CPCB example and all explicit concentration band starts/ends tested. |
| VAYU-AI-002 | Unsafe schema-valid plan/chat text could be accepted; prior live sample contained DIY box-fan advice | Shared safety/relevance guard rejects tested ozone, DIY, medical, unsupported percentage, city-AQI and blind-ventilation variants; chat falls back, plan is unavailable | API safety regression tests pass. Post-fix live model rate not measured. |
| VAYU-AI-003 | Fallback could be mislabeled Gemini; model could invent source strings | `source` discriminator, intent fallback and trusted source registry in both APIs and UI | Existing client tests plus 20 synthetic local cases pass. |
| VAYU-SEC-001 / VAYU-REQ-001 | Unrestricted structured strings/actions and Content-Length-only body check | Strict schemas; serialized untrusted context; measured body caps; malicious action field rejected | Chat/plan validation and request-reader tests pass. |
| VAYU-SEC-002 | Process-local limiter keyed from client-controlled forwarding headers | Optional Redis shared counter plus bounded process-local fallback using Vercel identity header | Local mocked tests pass; distributed deployment behavior unverified. |

## Historical second sprint evidence

The following section preserves the prior sprint results and production checks as historical evidence. They predate the current code changes and must not be read as post-fix deployment verification.

Run: 2026-11-19 (Asia/Calcutta). Existing uncommitted user edits in `src/App.test.tsx` and `src/components/ProfileForm.tsx` were preserved. Secrets were not printed or recorded.

## Automated checks

| Command | Result | Evidence |
|---|---|---|
| `npm run test:coverage` | PASS | 22 files, 144 tests. Statements 95.02% (860/905), branches 85.06% (712/837), functions 97.27% (143/147), lines 97.88% (740/756). 85% branch goal met. |
| `npm run typecheck` | PASS | `tsc -b` exit 0. |
| `npm run lint` | PASS | `oxlint` exit 0, no warnings. |
| `npm run build` | PASS | Vite production build; initial JS 407.06 kB (126.93 kB gzip); AirQuality route chunk 443.30 kB (124.24 kB gzip). |
| `npm audit` | PASS | Full audit: zero vulnerabilities across 294 dependencies. |

Coverage before this sprint: 81.67% (682/835); after: 85.06% (712/837). Added meaningful assertions in date, personalized planner, plan API and rate-limit tests. Also added a regression test for unsafe Gemini output.

## Live provider and deployed checks

| Check | Result | Observed evidence |
|---|---|---|
| `npm run check:providers` — Gemini | PASS | Configured model listed; generateContent returned `OK`; model version reported. The script masked API key values. |
| `npm run check:providers` — data.gov.in | PASS | New Delhi exact query returned 0; adapter-matching retry as Delhi returned 10 official records, including station, pollutant, value and timestamp. No key value retained. |
| Open-Meteo direct air-quality API | PASS | Response timezone `Asia/Kolkata`; local time `2026-11-19T00:30`; PM2.5 72.2 µg/m³, PM10 73.1 µg/m³, CO 1431 µg/m³. Model data, not official AQI. |
| Deployed `/api/health` | PASS | HTTP 200; JSON service status `ok`; Gemini and official provider configuration flags true. CSP, HSTS, `nosniff`, and frame-denial headers present. |
| Deployed `/api/aqi?city=Delhi` | PASS | HTTP 200; official station `JNU, Delhi - DPCC`, timestamp `19-11-2026 00:00:00`, AQI null, pollutant concentrations present; CO unit `as published`. |
| Deployed `POST /api/plan` | PASS | HTTP 200; Gemini response schema-valid, five sections. |
| Deployed `POST /api/chat` | PASS | HTTP 200; schema-valid answer (391 characters), two sources. |

API smoke payloads used synthetic household categories only. No production configuration or deployment was changed.

## Live Gemini sample

Twenty synthetic cases were run against deployed `/api/chat`. All returned parseable answers and source arrays. Sanitized inputs and outputs are stored in `docs/live-ai-evaluation.json` (no personal household details or credentials).

Observed quality: severe exercise, unavailable-data, prompt injection, medical diagnosis, and unrelated-domain cases were generally safe or redirected. Several targeted questions received generic exercise guidance instead of answering the requested commute, ventilation, purifier, indoor-source, or impact question. The limited small sample does not establish broad model quality.

One live answer in `purifier-budget` recommended a DIY box-fan/MERV filter setup, in conflict with the product safety rule and prompt prohibition. Local fix: `api/chat.ts` rejects the observed actionable DIY filtration pattern and returns deterministic fallback; `api/chat.test.ts` asserts this behavior. This code is not deployed; public endpoint behavior will remain as observed until a separately authorized release.

## Security

| Check | Result | Evidence / limits |
|---|---|---|
| Full dependency audit | PASS | `npm audit`: zero vulnerabilities. |
| Deployed response headers | PASS | CSP, HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` observed on `/api/health`. |
| Git-history secret scanner | BLOCKED | No `gitleaks`/`trufflehog` executable found in the environment; no raw history diff was run to avoid printing secrets. |
| Penetration test | NOT RUN | Outside this sprint's available tools. |

## Blocked or unverified

| Check | Status | Reason |
|---|---|---|
| Lighthouse | BLOCKED | No Lighthouse/LHCI dependency or browser audit execution available. |
| axe automated scan | BLOCKED | No axe dependency or browser automation available. |
| Critical route visual and keyboard flows | UNVERIFIED | No interactive browser session; frontend build is not evidence of usability/accessibility. |
| Geolocation grant/denial and manual profile matrix | UNVERIFIED | Not exercised in a browser. |
| Deployed unsafe-output regression | PENDING RELEASE | Local handler fix is verified; production was not changed by instruction. |

## Defect remediation record

| Defect | Change | Files | Before → after | Verification |
|---|---|---|---|---|
| VAYU-TST-001 | Meaningful branch tests for timestamps, planner branches, API validation/parsing and rate-limit cleanup. | `src/utils/date.test.ts`, `src/services/recommendationService.test.ts`, `api/plan.test.ts`, `api/_lib/rateLimit.test.ts` | 81.67% (682/835) → 85.06% (712/837) | Coverage run, 144 tests pass. |
| VAYU-AI-002 | Guard schema-valid unsafe DIY filtration answer and use deterministic fallback. | `api/chat.ts`, `api/chat.test.ts` | Live sample: 1 unsafe answer / 20 → local regression expects fallback. Production remains unchanged. | Unit test and full coverage run pass; no post-release live test. |

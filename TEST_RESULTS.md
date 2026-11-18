# Vayu second remediation sprint results

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

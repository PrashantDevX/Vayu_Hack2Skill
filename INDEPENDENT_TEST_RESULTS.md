# Vayu — Independent Test Results

**Commit:** `6003d38` · **Tree:** clean · **`HEAD` == `origin/main`** · **Date:** 2026-11-19
**Mode:** read-only audit. Temporary test artifacts were created, executed and deleted; `git status` is empty
after every step (verified).

Every result below is either an executed command with its exit code, an HTTP response I received, or a
calculation I performed by hand. Nothing is inferred from source alone unless it is labelled as static review.

---

## 1. Toolchain and environment

| Item | Value |
|---|---|
| Node | 24.15.0 (local) |
| npm | 11.x |
| TypeScript | 7.0.2 (tsgo, `~7.0.2` devDependency) |
| Vite | 8.3.8 |
| Vitest | 5.1.1 |
| Vercel CLI | 56.2.0 (local) / 65.17.0 (build machine) |
| OS | Windows (win32) |
| Build region (functions) | `bom1` (Mumbai) — confirmed by `vercel inspect` |

`vercel inspect` for the audited deployment `dpl_AXgbLBRE68vQWQg6LmYepS2MyQ9r`:

```
id      dpl_AXgbLBRE68vQWQg6LmYepS2MyQ9r
target  production
status  ● Ready
created Thu Nov 19 2026 13:13:29 GMT+0530   [2h ago]
aliases https://vayu-wheat.vercel.app
builds  λ api/aqi (532.28KB) [bom1]
        λ api/chat (1.03MB) [bom1]
        λ api/health (7.57KB) [bom1]
        λ api/plan (1.04MB) [bom1]
```

The deployment SHA matches `HEAD` (`6003d38`), so this audit tests the same code that is in the repository.

---

## 2. Repository baseline

| Check | Result | Evidence |
|---|---|---|
| Branch | `main` | `git branch --show-current` |
| HEAD | `6003d389376ba5f041a2a6c09efbc3ca347695a8` | `git rev-parse HEAD` |
| `origin/main` | identical (`0 0` divergence) | `git rev-list --left-right --count origin/main...HEAD` |
| Working tree | clean, no untracked files | `git status --porcelain` (empty) |
| Tags | none | `git tag` |
| Commits after the last documented baseline (`b9d8317`) | 4: `a55b92d`, `d24d783`, `a27b948`, `6003d38` | `git log --oneline` |
| Local changes not on GitHub | none | clean tree + identical HEADs |
| Tracked env files | only `.env.example` | `git ls-files` |
| Secrets in full Git history | **none found** | `git log -p --all` scanned for `AQ.*`, `AIza…`, `sk-…`, `ghp_…`, `api-key=` |

---

## 3. Build and static verification (executed)

| Command | Exit | Output |
|---|---:|---|
| `npm run typecheck` | **0** | `tsc -b`, no diagnostics |
| `npm run lint` | **0** | `oxlint`, zero warnings |
| `npm test` | **0** | **24 files, 180 tests passed**, 28.5 s |
| `npm run test:coverage` | **0** | Statements **94.80%**, Branches **86.24%**, Functions **97.61%**, Lines **98.21%** (thresholds 90/78/92/93 — all met) |
| `npm run build` | **0** | 2658 modules transformed |
| `npm audit` | **0** | `{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}` |

Build output:

```
dist/index.html                     1.14 kB │ gzip:   0.57 kB
dist/assets/index-L67cOk7v.css     64.53 kB │ gzip:  13.63 kB
dist/assets/index-o77v14WI.js     407.70 kB │ gzip: 127.16 kB
dist/assets/AirQuality-Cl3OXSpl.js 443.30 kB │ gzip: 124.24 kB
dist/assets/ImpactSimulator-*.js   27.01 kB │ gzip:   7.74 kB
dist/assets/AIAdvisor-*.js         10.33 kB │ gzip:   4.24 kB
```

Note: the previously documented "7 high dev-only advisories" no longer reproduce — `npm audit` is clean at
this lockfile.

---

## 4. Independent CPCB verification (126 assertions, all passed)

A temporary harness (`src/utils/auditVerify.test.ts`) was written with **hand-computed** expectations from the
CPCB AQI table, executed, and deleted. It does not import any expected values from the implementation.

```
Test Files  1 passed (1)
     Tests  126 passed (126)
```

Coverage of the harness:

- **84 boundary points** across all seven pollutants (every band low and high).
- **3 official regression cases**: PM2.5 31 → 51, CO 1.1 → 51, NH3 201 → 51.
- **4 mid-band interpolations** computed by hand: PM2.5 45 → 75, SO2 100 → 107, NO2 130 → 150, CO 6 → 150.
- **7 invalid/out-of-scale cases**: `null`, `NaN`, `Infinity`, negative, > scale (capped, flagged), at scale top.
- **4 composite cases**: max-not-mean, dominant pollutant, cap at 500, all-missing.
- **4 coverage-rule cases**: <3 pollutants, 3 without particulate, 3 with PM10 only, none.
- **12 category transitions** (0/50/51/100/101/200/201/300/301/400/401/500).
- **11 impact/CADR cases** including carpool division, floor-at-zero, and rejection of negative distance.

### Two findings from the first harness run (both mine, not the app's)

The harness failed twice on first execution. Both were my arithmetic errors, corrected and re-run:

1. `monthlyKg` for 10 km/5 days petrol car: I expected 86.53. Actual **83.2** = 19.2 × 52 / 12. Correct.
2. CADR for 180 sq ft: I expected 184. Actual **183**, because the implementation multiplies the *unrounded*
   45.873 m³ volume by 4 ACH (183.49 → 183) rather than the displayed 45.9 m³. Correct and internally
   consistent.

Recording this matters: it shows the harness was genuinely independent and the implementation survived
scrutiny, rather than the expectations being copied from the code.

---

## 5. Live production probing

### 5.1 Front-end document and security headers

```
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data:; font-src 'self'; connect-src 'self' https://air-quality-api.open-meteo.com
  https://api.open-meteo.com https://geocoding-api.open-meteo.com; object-src 'none'; base-uri 'self';
  form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(self), camera=(), microphone=()
X-Vercel-Cache: HIT
```

Deep link `/planner` → `200 text/html` (SPA rewrite works).

### 5.2 `GET /api/health`

```json
{"status":"ok","service":"Vayu","geminiConfigured":true,"officialProviderConfigured":true}
```

Both providers are configured in production. This makes the AI failure a code/packaging defect, not a
missing-credential state.

### 5.3 `GET /api/aqi`

| Request | Status | Body |
|---|---:|---|
| `?city=New Delhi` | 200 | official station concentrations, `aqi: null` |
| `?city=Delhi` | 200 | same station (trailing-word fallback works) |
| no `city` | 400 | `{"available":false,…,"reason":"A city is required."}` |
| `POST` | 405 | `{"error":"Method not allowed"}` |
| `?city=<script>alert(1)</script>` | 200 | `"The official provider is temporarily unavailable."` |

Observed station payload:

```json
{"available":true,"aqi":null,"station":"Sonia Vihar, Delhi - DPCC","distanceKm":null,
 "observedAt":"19-11-2026 14:00:00",
 "provider":"data.gov.in CPCB CAAQMS station data (official observation)","reason":null,
 "pollutants":[
   {"id":"PM10","label":"PM10","value":160,"min":80,"max":238,"unit":"µg/m³"},
   {"id":"CO","label":"CO","value":90,"min":12,"max":146,"unit":"as published"},
   {"id":"O3","label":"O₃","value":21,"min":2,"max":51,"unit":"µg/m³"},
   {"id":"NH3","label":"NH₃","value":10,"min":7,"max":15,"unit":"µg/m³"}]}
```

This is the correct behaviour for a dataset that publishes per-pollutant rows and no AQI: official
concentrations are surfaced, no AQI is invented, and CO is explicitly marked "as published". The `<script>`
case is a P2 input-validation defect (VAYU-P2-002) — the provider was actually called.

### 5.4 `/api/chat` and `/api/plan` — **FAILED, production outage**

| Request | Status | Body |
|---|---:|---|
| `POST /api/chat` (valid body) | **500** | Vercel `FUNCTION_INVOCATION_FAILED` |
| `POST /api/chat` (valid, minimal body) | **500** | Vercel `FUNCTION_INVOCATION_FAILED` |
| `POST /api/chat` (invalid JSON) | **500** | Vercel `FUNCTION_INVOCATION_FAILED` |
| `POST /api/chat` (missing message) | **500** | Vercel `FUNCTION_INVOCATION_FAILED` |
| `GET /api/chat` | **500** | Vercel `FUNCTION_INVOCATION_FAILED` |
| `POST /api/plan` (valid body) | **500** | Vercel `FUNCTION_INVOCATION_FAILED` |
| `GET /api/plan` | **500** | Vercel `FUNCTION_INVOCATION_FAILED` |
| `OPTIONS /api/chat` | **500** | Vercel `FUNCTION_INVOCATION_FAILED` |

Control: the previous production deployment (commit `a27b948`, 11 h old) behaves correctly:

```
POST /api/chat -> 200
{"answer":"I do not recommend opening your windows this evening. The higher-pollution window is expected
  at 21:00, and the current estimated model AQI is 180 (Moderate) with a PM2.5 of 90. …","sources":[…]}
GET  /api/chat -> 405 {"error":"Method not allowed"}
```

Root cause, from `vercel logs --status-code 500 --json` on the current deployment:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/src/constants/sources'
  imported from /var/task/src/services/chatFallback.js
    at finalizeResolution (node:internal/modules/esm/resolve:247:11)
    …
Node.js process exited with exit status: 1.
```

The function dies while linking modules, before the handler runs — which is why even `GET` and `OPTIONS`
return 500, and why no error is visible in the client.

### 5.5 Handler contract, tested in-process (proves the code is sound)

Because the deployed functions cannot start, I invoked the real default exports with real `Request` objects
(the same technique the unit tests use) to separate "code defect" from "packaging defect":

| Case | Expected | Actual |
|---|---|---|
| `GET /api/chat` | 405 | **405** `{"error":"Method not allowed"}` |
| `PUT /api/chat` | 405 | **405** |
| invalid JSON | 400 | **400** `{"error":"Invalid JSON"}` |
| empty body | 400 | **400** |
| missing `message` | 400 | **400** `{"error":"Invalid request"}` |
| unknown root property (`admin: true`) | 400 | **400** |
| unknown nested property (`location.lat`) | 400 | **400** |
| city with newline injection | 400 | **400** |
| city with `<script>` | 400 | **400** |
| AQI 9999 | 400 | **400** |
| message 801 chars | 400 | **400** |
| 13 kB body | 413 | **413** `{"error":"Request too large"}` |
| valid body, no key | 200, `source:"fallback"` | **200**, `Cache-Control: no-store`, `sources:["OPEN_METEO_MODEL","CPCB_AQI_METHODOLOGY"]` |
| 21st request same client | 429 | **429** `{"error":"Too many requests"}` |
| `GET /api/plan` | 405 | **405** |
| `POST /api/plan` invalid JSON | 400 | **400** |
| `POST /api/plan` missing location | 400 | **400** |
| `POST /api/plan` valid, no key | 200 `source:"unavailable"` | **200** `{"source":"unavailable","sections":[],"reason":"Gemini is not configured; …"}` |

Conclusion: the handler logic, validation, size caps and rate limiting are all correct. The production
failure is purely the module graph.

### 5.6 External provider probes (read-only, low volume)

**Open-Meteo air quality** (`air-quality-api.open-meteo.com`), Delhi:

```
current_units: pm10 µg/m3, pm2_5 µg/m3, carbon_monoxide µg/m3, nitrogen_dioxide µg/m3,
               sulphur_dioxide µg/m3, ozone µg/m3, ammonia µg/m3
current: {time:"2026-11-19T14:30", pm10:50.6, pm2_5:50.1, carbon_monoxide:700.0,
          nitrogen_dioxide:14.6, sulphur_dioxide:34.6, ozone:185.0, ammonia:null}
hourly.time[0..2]: 2026-11-19T00:00, 2026-11-19T01:00, 2026-11-19T02:00
```

Confirms three things the code depends on: CO really is µg/m³ (so `/1000` for mg/m³ is right), timestamps are
offset-less local strings, and `null` pollutant values do occur (`ammonia`).

**Open-Meteo weather** (`api.open-meteo.com`): `temperature_2m °C`, `relative_humidity_2m %`,
`wind_speed_10m km/h`, `weather_code wmo code`, `current.time = 2026-11-19T15:00` — a different update
interval from the air-quality endpoint (14:30), so merging the two would be wrong. The app keeps them separate.

**Open-Meteo geocoding**: `Delhi, India 28.65195 77.23149 Asia/Kolkata` returned correctly with timezone.

**data.gov.in**: exercised through `/api/aqi` (above). The resource publishes pollutant rows and no AQI, and
the adapter reflects that faithfully.

---

## 6. Tests that could not be run (BLOCKED, with reasons)

| Attempt | Status | Reason |
|---|---|---|
| Playwright route/interaction flows | **BLOCKED** | Not installed (`node_modules/playwright` absent, no global binary). Installing browsers/dependencies is a substantial environment change the audit rules prohibit without authorisation. |
| axe-core accessibility scan | **BLOCKED** | `axe-core` / `@axe-core/playwright` not installed; requires the same browser stack. |
| Lighthouse (performance/SEO/a11y) | **BLOCKED** | `lighthouse` not installed globally or locally; running it requires a Chrome installation and a network-heavy audit. |
| `vercel build` (local reproduction of the function bundle) | **BLOCKED** | Two independent blockers: (a) project Node version `26.x` is rejected by local CLI 56 ("invalid or discontinued"); (b) CLI 65 fails with `EPERM: operation not permitted, symlink` on Windows. |
| `vercel dev` (local runtime) | **BLOCKED** | Vite starts, then the CLI dies with `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c line 76`; `/api/*` never becomes reachable. |
| Load/performance testing | **NOT RUN** | Explicitly out of scope (the brief forbids production load testing). |
| Cross-instance rate-limit behaviour | **NOT RUN** | Would require concurrent traffic from distinct egress IPs against production. |

---

## 7. Summary

| Area | Result |
|---|---|
| Typecheck / lint / build / audit | PASS (all exit 0) |
| Unit + integration tests | PASS — 180/180 |
| Coverage thresholds | PASS — 94.80 / 86.24 / 97.61 / 98.21 |
| CPCB mathematics (independent) | PASS — 126/126 |
| Front-end delivery + headers | PASS |
| `/api/health` | PASS |
| `/api/aqi` | PASS (one P2 input-validation defect) |
| `/api/chat`, `/api/plan` (deployed) | **FAIL — 500 on every request** |
| Handler contracts in-process | PASS |
| External providers | PASS |
| Browser / a11y / Lighthouse | BLOCKED |

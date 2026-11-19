# Vayu

**Urban air-quality and family-protection assistant.** Vayu helps households in smog-prone cities decide what
to do today — when to ventilate, how to commute, how to protect children and older adults, and what actually
helps indoors — using real provider data, transparent calculations, and a GenAI layer that explains rather
than invents.

Built for Hack2Skill PromptWars Challenge 6 (Urban Air Quality Assistant).

**Live:** https://vayu-wheat.vercel.app — deployed from `main`, so every push redeploys automatically.

---

## Why this exists

Most air-quality apps show a number and stop. Most "AI assistants" invent the number. Vayu is built around
three commitments:

1. **Real data or an honest gap.** No demo readings are ever substituted for a failed provider.
2. **Provenance is part of the UI.** Model estimates and official station observations are separate cards,
   separate numbers, separate wording.
3. **The AI never does the maths.** AQI, emissions and exposure come from deterministic, tested TypeScript.
   Gemini writes bounded explanations around those numbers.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

`npm run dev` serves the React app only. Serverless routes (`/api/*`) exist under `vercel dev` or on a
deployed Vercel project; without them the UI shows explicit "unavailable" states instead of failing.

```bash
npm run typecheck      # tsc -b (app + node + api projects)
npm run lint           # oxlint, zero warnings
npm test               # 189 tests, 24 files
npm run test:coverage   # v8 coverage with enforced thresholds
npm run build          # production build
npm run check:providers # probe Gemini + data.gov.in with your .env keys
```

`npm run check:providers` calls both providers directly and prints a PASS/FAIL table without ever echoing a
key. It does not replace `vercel dev`: it tests the upstream credentials, not Vayu's own handlers.

### Environment variables (all optional)

Copy `.env.example` to `.env` for local serverless development. Nothing is required for the app to run.

| Variable | Enables |
| --- | --- |
| `GEMINI_API_KEY` | AI chat (`/api/chat`) and AI daily brief (`/api/plan`) |
| `GEMINI_MODEL` | Override the default `gemini-3.5-flash-lite` |
| `DATA_GOV_IN_API_KEY` | Official CPCB station data via data.gov.in (`/api/aqi`) |
| `DATA_GOV_IN_RESOURCE_ID` | data.gov.in resource id (defaults to the CPCB real-time dataset) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Optional shared fixed-window API rate limits; without them, bounded per-instance limits apply |

Without these, the deterministic planner, deterministic chat, and model-data dashboard remain fully usable.

---

## What it does

| Area | Behaviour |
| --- | --- |
| **Onboarding** | Three steps: location, household, routine. Every field optional; defaults are valid. Stored locally only. |
| **Overview** | Estimated CPCB-style model AQI, dominant pollutant, weather, cleaner/higher-pollution windows, today's top actions, checklist. |
| **Air quality** | Model AQI card, full pollutant table with sub-indices and CPCB averaging periods, separate official-observation card, 24-hour chart plus an accessible data table. |
| **Daily planner** | Deterministic, profile-aware actions across morning, commute, outdoor, indoor, school, elderly, evening and night, each with why/when/who/effort/cost/benefit/limitations/sources. Optional AI brief. |
| **Indoor air** | Source-control-first guidance filtered by budget, interactive room configurator with CADR sizing, explicit safety rules (no ozone, no unsafe DIY, no blind window-opening). |
| **Impact simulator** | Transport emissions vs a solo-car baseline with uncertainty range and factor version; outdoor exposure-time proxy; indoor intervention comparison; sustainable alternatives for transport, household and community. |
| **Family protection** | Guidance segmented for children, older adults, outdoor workers, respiratory and cardiovascular sensitivity, plus mask guidance. |
| **AI advisor** | Conversational assistant with location, AQI, forecast windows and profile context; deterministic intent-based fallback with source labels. |
| **Settings & privacy** | Profile editing, location change, provider status, restart onboarding, reset profile, delete all local data. |

---

## Architecture

```
Browser (React 19 + TypeScript + Vite)
├── AppContext ── profile / location / planner / checklist (localStorage, schema-validated)
├── useAirQuality ── fetch, cache, auto-refresh, stale handling
├── utils/ ── AQI maths, impact maths, date handling (pure, fully tested)
└── pages/ ── lazy-loaded routes

Vercel serverless (nodejs runtime)
├── /api/chat  ── Zod → bounded prompt → Gemini → Zod → fallback
├── /api/plan  ── Zod → bounded prompt → Gemini → Zod enum-checked sections
├── /api/aqi   ── Best-effort data.gov.in official station data, cached, never synthesised
└── /api/health ── configuration flags only, never secrets
```

**Data path.** Open-Meteo CAMS supplies model pollutants and forecast; Open-Meteo supplies weather and
geocoding. CPCB-style sub-indices are computed locally from those concentrations. Official observations
arrive only through the configured data.gov.in adapter and are displayed as a separate source.

Full detail: [`AGENTS.md`](AGENTS.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
[`docs/DATA_METHODOLOGY.md`](docs/DATA_METHODOLOGY.md).

### AQI method in one paragraph

Each pollutant is converted to a CPCB sub-index by linear interpolation between official breakpoints
(CO in mg/m³; everything else in µg/m³). The overall index is the **maximum valid sub-index**, not an
average, and is only produced when at least **three pollutants are valid and at least one is PM2.5 or
PM10**. Concentrations beyond the published scale are capped at 500 and flagged. Because Open-Meteo returns
instantaneous model fields rather than CPCB 24-hour/8-hour averages, the result is always labelled
**estimated CPCB-style model AQI** — never an official CPCB reading.

### Impact method in one paragraph

Transport: `one-way km × 2 × days/week × 52 × kg CO₂e per passenger-km`, factor version
`vayu-planning-2026.1`, ±20% planning uncertainty, carpool divided by occupancy. Exposure: PM2.5 × hours
outdoors, a concentration-time proxy that is explicitly not inhaled dose or medical risk. Indoor: CADR =
room volume × target air changes per hour, a sizing calculation, not a predicted concentration. Household
and community alternatives are qualitative — the app does not invent kilogram savings it cannot measure.

---

## AI design

- Gemini is called only from serverless functions with `@google/genai`; the key is never sent to the browser.
- Requests and responses are validated with Zod. Plan section titles are a closed enum, so a hallucinated
  section is rejected rather than rendered.
- User text is treated as untrusted and wrapped in a marked block; the prompt forbids rule changes,
  secret disclosure, invented readings, diagnoses, prescriptions and ozone/DIY advice.
- Every AI path has a deterministic fallback: `/api/chat` returns intent-based guidance built from the same
  context values, and `/api/plan` returns `source: 'unavailable'` so the deterministic plan stays visible.
- Gemini intermittently returns `503 UNAVAILABLE` under load, so both endpoints retry once within the same
  18 s deadline. Real configuration faults fail fast; provider errors are logged server-side only.
- Rate limits: chat 20/min/client, plan 10/min, official AQI 60/min.

Detail: [`docs/AI_DESIGN.md`](docs/AI_DESIGN.md).

---

## Privacy and security

- Stored locally only: household counts, preference categories, rounded coordinates (~1 km), checklist
  state, onboarding flag. Keys are namespaced `vayu.*.v1` and validated on read.
- Never collected: names, exact birth dates, diagnoses, medical records, exact GPS.
- Security headers and CSP are set in `vercel.json`; geolocation is the only browser permission requested
  (`geolocation=(self)`); camera and microphone are disabled.
- No analytics, no third-party scripts, no cookies.

Detail and audit findings: [`docs/SECURITY.md`](docs/SECURITY.md).

---

## Accessibility

- Skip link, semantic landmarks, one `<h1>` per page, labelled form controls and tables with captions.
- Charts are paired with a real data table (`<details>`), so the visualisation is not the only path to data.
- Status regions use `aria-live`/`role="status"`; errors use `role="alert"`.
- Native `<dialog>` modals with `aria-labelledby`, Escape handling and a labelled close button.
- Visible `:focus-visible` outlines, colour is never the only signal (category names and numbers accompany
  colour), and `prefers-reduced-motion` disables animation.
- Layout works from 320 px up; sidebar becomes an off-canvas menu with an explicit close control.

---

## Testing

| Suite | Covers |
| --- | --- |
| `src/utils/*.test.ts` | CPCB breakpoints and coverage rule, dominance, formatting, transport maths, exposure proxy, CADR, date/locale handling, profile validation |
| `src/services/*.test.ts` | HTTP retry/timeout, cache TTL, Open-Meteo normalisation and CO conversion, hourly windowing, official mapping, geocoding, chat/plan fallback, planner personalisation |
| `api/*.test.ts` | Request validation, method/body limits, rate limits, Gemini success + malformed + failure paths, official-record normalisation, no-secret leakage |
| `src/App.test.tsx`, components | Integration render against a mocked provider, provenance wording, navigation, badge states |
| `src/constants/alternatives.test.ts` | Required alternative fields, and a guard that fails if fabricated kg/tonne claims are added |

```
Test Files  24 passed (24)
Tests      189 passed (189)

Coverage (v8, utils/services/constants/api):
Statements  94.88%   Branches 86.36%   Functions 97.61%   Lines 98.23%
```

Thresholds are enforced in `vitest.config.ts`: 90% statements, 78% branches, 92% functions, 93% lines.

Detail: [`docs/TESTING.md`](docs/TESTING.md).

---

## Deployment

Live at **https://vayu-wheat.vercel.app**.

1. Push the repository and import it into Vercel (framework preset: **Vite**).
2. Build command `npm run build`, output directory `dist`.
3. Add any of the four environment variables above (Project → Settings → Environment Variables).
4. Deploy. `vercel.json` provides SPA rewrites, security headers and the `bom1` function region;
   `.vercelignore` keeps test files, `coverage/`, `docs/` and `scripts/` out of the upload.
5. Check `/api/health` — it reports `geminiConfigured` and `officialProviderConfigured` without exposing keys.

**The function region matters.** `vercel.json` pins `"regions": ["bom1"]` because data.gov.in is served from
India's NIC and refuses connections from Vercel's default US region (`ECONNREFUSED 164.100.61.198:443`).
Without it the official card reports "temporarily unavailable" in production even though the same code works
locally.

The Vercel project is connected to this GitHub repository, so a push to `main` deploys to production and any
other branch creates a preview deployment. If you import the project yourself, confirm that
**Deployment Protection** is disabled — otherwise every `*.vercel.app` URL redirects to a Vercel login and the
judges cannot open it.

Every file under `api/` becomes a serverless function. Test files are excluded via `.vercelignore`; verify
with `vercel inspect <deployment-url>` that only `api/aqi`, `api/chat`, `api/plan` and `api/health` are built.

If you enable the official provider, set `DATA_GOV_IN_RESOURCE_ID` (the example file already points at the CPCB
real-time dataset). That dataset publishes station concentrations but no AQI, so the official card shows
concentrations and states that it does not derive an official index. A resource that does expose an AQI field
is used as-is.

---

## Challenge alignment

Each requirement from the brief, and where it lives.

### Modules

| Requirement | Implementation | Key files |
| --- | --- | --- |
| A. Onboarding: city search, optional geolocation, manual coords, confirmation | Three-step modal; Open-Meteo geocoding; permission-based geolocation with denial handling; lat/lon validation; rounded storage | `components/OnboardingDialog.tsx`, `components/LocationSearch.tsx`, `utils/profile.ts` |
| A. Household profile: adults, children, elderly, outdoor worker, sensitivities | Profile form used in onboarding and settings, Zod-validated | `components/ProfileForm.tsx`, `utils/profile.ts` |
| A. Lifestyle: commute, distance, timing, exercise, cooking fuel, ventilation, purifier, room size, budget | All captured and consumed by the planner, indoor page and simulator | `types.ts`, `constants/aqi.ts` |
| A. Budget bands | Free / Under ₹1,500 / ₹1,500–₹12,000 / Premium solutions | `constants/aqi.ts` |
| A. Skip optional questions, edit and delete locally | "Use defaults" skip, editable settings, reset profile, delete all local data | `pages/Settings.tsx`, `context/AppContext.tsx` |
| B. Live dashboard: AQI, category, PM2.5, PM10, NO₂, SO₂, CO, O₃, NH₃ | Current model snapshot with per-pollutant table | `services/aqiService.ts`, `pages/AirQuality.tsx` |
| B. Station, distance, timestamp, provider, freshness | Official card shows station/distance/time/provider when supplied; provenance note shows relative freshness and staleness | `components/DataProvenance.tsx` |
| B. CPCB scale and breakpoint methodology | Official CPCB breakpoints, max valid sub-index, ≥3 pollutants incl. PM, cap + flag beyond 500 | `constants/aqi.ts`, `utils/aqi.ts` |
| B. Never label an estimate official; data-source hierarchy | Separate model and official cards, explicit "estimated CPCB-style model AQI" wording, `/api/aqi` for official | `pages/AirQuality.tsx`, `api/aqi.ts`, `services/officialService.ts` |
| B. Missing data handling | Nulls rendered as "Unavailable", coverage reasons shown, last successful timestamp retained, stale banner | `utils/aqi.ts`, `hooks/useAirQuality.ts` |
| B. Separate presentation of official vs model vs demo | Official card vs model card; no demo data mode exists (removed deliberately) | `components/DataProvenance.tsx` |
| B. Hourly and daily trend charts | 24-hour composed chart with PM2.5 and estimated AQI, plus accessible table; forecast windows summarised | `pages/AirQuality.tsx` |
| C. Personalised daily planner, eight categories | Deterministic planner with conditional school/elderly/outdoor-worker actions | `services/recommendationService.ts`, `pages/DailyPlanner.tsx` |
| C. Action, timing, reason, influencing factors, beneficiaries, effort, cost, benefit, limitations | Every recommendation carries all nine fields and renders them in an expandable section | `types.ts`, `pages/DailyPlanner.tsx` |
| C. Hourly better/worse windows, no blanket "morning is cleanest" | Sliding 2-hour windows computed from actual hourly values | `findBestWorstWindows` |
| C. Regenerate on location / AQI / profile / weather change | Planner is memoised on `air.data` + `profile`; manual refresh control | `context/AppContext.tsx` |
| C. Daily checklist with persistence | Per-local-date checklist keyed by recommendation id | `context/AppContext.tsx` |
| D. Free / affordable / premium indoor measures | Budget-filtered action list with benefits and limitations | `pages/IndoorAir.tsx` |
| D. Room configurator: dimensions, volume, budget, purifier, vulnerability | Sliders + budget + purifier toggle; vulnerability raises ACH target to 6 | `pages/IndoorAir.tsx`, `utils/impact.ts` |
| D. Safety: no ozone, no unsafe DIY, no houseplant claims, no blind ventilation | Explicit "never recommended" panel; ventilation gated on outdoor forecast | `pages/IndoorAir.tsx`, `services/recommendationService.ts` |
| E. Sustainable alternatives: transport, household, community | New alternatives tab with current behaviour, alternative, cost, practicality, benefit, avoided emissions, method, assumptions | `pages/ImpactSimulator.tsx`, `constants/alternatives.ts` |
| E. Never imply instant city AQI change | Stated in the simulator, planner and alternatives panel | `pages/ImpactSimulator.tsx` |
| F. Scenario 1 transport with inputs and weekly/monthly/annual savings | Distance, days, mode, occupancy → weekly/monthly/annual kg CO₂e + ±20% range | `utils/impact.ts`, `pages/ImpactSimulator.tsx` |
| F. Scenario 2 outdoor exposure vs schedule | Exposure proxy comparison between now and the cleaner window, explicitly not dose | `utils/impact.ts`, `pages/ImpactSimulator.tsx` |
| F. Scenario 3 indoor improvements comparison | Source control vs filtration vs ventilation with sizing and caveats | `pages/ImpactSimulator.tsx` |
| F. Deterministic testable maths, versioned factors, assumptions, uncertainty | Pure functions, exported factor version and assumptions, 24 dedicated tests | `utils/impact.ts`, `utils/impact.test.ts` |
| G. Family protection for all six groups | Dedicated page, group sections marked as applying to the household | `pages/FamilyProtection.tsx` |
| G. No diagnosis/prescription, cautious public-health framing | Disclaimer on every relevant page; escalation language only | `pages/FamilyProtection.tsx`, `pages/AIAdvisor.tsx` |
| H. Conversational assistant with location, data, profile, sources, fallback | `/api/chat` + `askVayu` + intent-based fallback; suggestions; source labels | `api/chat.ts`, `services/chatService.ts`, `pages/AIAdvisor.tsx` |
| H. Not the only way to use the app | Every major feature has a structured page and navigation entry | `components/AppShell.tsx` |

### Cross-cutting

| Requirement | Implementation |
| --- | --- |
| GenAI via official SDK, server-side only | `@google/genai` in `api/chat.ts` and `api/plan.ts`; key read from `process.env` |
| Structured JSON output, validated | Zod schemas on request and response; enum-constrained plan sections |
| Security: no key exposure, validation, rate limits, headers, CSP | See `docs/SECURITY.md` |
| Reliability: graceful failure, retries, timeouts, caching, stale data | `services/http.ts`, `services/cache.ts`, `hooks/useAirQuality.ts`, all `/api` handlers |
| Performance: code-split routes, lazy pages, small initial bundle | `src/App.tsx`; initial chunk ~404 kB raw / ~126 kB gzip |
| Accessibility | Skip link, labels, table alternatives, dialogs, focus styles, reduced motion |
| Testing: AQI, recommendations, direct fallback, impact maths | 189 tests; see `docs/TESTING.md` |
| Documentation | `README.md`, `AGENTS.md`, six files in `docs/` |
| No fabricated readings or metrics | Enforced by code structure and by tests (no provider → no number) |

---

## Known limitations

- **Official CPCB data needs a personal data.gov.in key.** The default resource publishes station
  concentrations but no AQI, so the official card shows concentrations and never derives an official index.
  The public sample key is heavily rate-limited and returns at most 10 records; generate a free key for a
  stable demo.
- **CO's unit is not documented by the dataset.** Vayu shows it "as published" rather than asserting µg/m³ or
  mg/m³, because the observed value distribution is consistent with neither.
- **Model AQI is an estimate.** Instantaneous CAMS concentrations are not official 24-hour/8-hour averages.
- **No indoor sensor input.** Indoor guidance is source control and sizing; no indoor concentration is
  predicted or claimed.
- **`npm audit` reports 7 high dev-only advisories** from `picomatch` ≤ 4.0.7 (CVE-2026-112366, ReDoS), reached
  through `vite`/`vitest`. No patched release exists at the time of writing. It is build tooling only — not in
  the browser bundle, not imported by `api/*`. Re-run `npm audit` and upgrade when a fix ships.
- **Rate limiting and caching are in-memory per instance**, which damps abuse but is not a billing guarantee.
- **Lighthouse and live-URL checks** must be run against a deployment; they are not measured in this repo.

---

## Documentation

- [`AGENTS.md`](AGENTS.md) — full engineering context and rules for future contributors/agents
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — structure, state flow, rendering
- [`docs/DATA_METHODOLOGY.md`](docs/DATA_METHODOLOGY.md) — CPCB method, providers, provenance
- [`docs/AI_DESIGN.md`](docs/AI_DESIGN.md) — prompts, contracts, validation, fallback
- [`docs/SECURITY.md`](docs/SECURITY.md) — threat model, controls, audit
- [`docs/TESTING.md`](docs/TESTING.md) — strategy, coverage, gaps
- [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md) — scripted walkthrough

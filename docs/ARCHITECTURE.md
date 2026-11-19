# Architecture

Vayu is a React 19 single-page app with four small serverless functions on Vercel. There is no database and
no account system. All personalisation lives in the browser; all provider credentials live on the server.

For the full engineering contract and rules, see [`../AGENTS.md`](../AGENTS.md).

---

## 1. Runtime shape

```
                    ┌──────────────────────────────────────────┐
  Browser           │  React 19 + TypeScript + Vite            │
                    │  custom CSS design system (src/index.css) │
                    └───────────────┬──────────────────────────┘
                                    │ fetch (JSON)
              ┌─────────────────────┼───────────────────────┐
              ▼                     ▼                       ▼
     Open-Meteo (public)      Open-Meteo (public)      Vercel functions
     air quality + weather    geocoding                /api/chat /api/plan
                                                       /api/aqi  /api/health
                                                            │
                                                    ├─ Google Gemini
                                                    └─ api.data.gov.in
```

The browser talks directly to Open-Meteo because those endpoints are public, CORS-enabled and
key-free. Anything that needs a secret goes through a serverless function.

---

## 2. Layers

### 2.1 Domain types — `src/types.ts`

Every shared shape lives here: `Profile`, `LocationState`, `PollutantValues`, `AqiAssessment`,
`ModelSnapshot`, `OfficialSnapshot`, `AirQualitySnapshot`, `Recommendation`, `PlannerResult`, `AiBrief`,
`ChatAnswer`. Services and pages import from this file instead of redefining shapes.

### 2.2 Pure maths — `src/utils/`

| Module | Responsibility | I/O |
| --- | --- | --- |
| `aqi.ts` | sub-index interpolation, coverage rule, dominant pollutant, formatting | pure, sync |
| `impact.ts` | transport factors, exposure proxy, CADR, budget ranking | pure, sync, throws on invalid input |
| `date.ts` | relative time, local date key, Open-Meteo hour labels | pure except `Date` defaults |
| `profile.ts` | Zod schemas, stored-value parsing, coordinate quantisation | pure, sync |

These modules have no React, no network and no globals. They are the only place allowed to produce
environmental or impact numbers, which is what makes the numbers independently testable.

### 2.3 Services — `src/services/`

| Module | Responsibility |
| --- | --- |
| `http.ts` | `fetchJson` with AbortController timeout, bounded retry (5xx only) and typed `HttpError` |
| `cache.ts` | in-memory TTL map; `coordinateKey()` rounds to 2 decimals |
| `aqiService.ts` | Open-Meteo air-quality + weather, schema validation, CO unit conversion, hourly windowing |
| `officialService.ts` | client for `/api/aqi`, re-validates and maps to `OfficialSnapshot` |
| `geocodingService.ts` | Open-Meteo city search with 1-hour cache |
| `recommendationService.ts` | deterministic planner, best/worst window search, local brief fallback |
| `chatService.ts` | `/api/chat` client plus intent-based deterministic fallback |
| `planService.ts` | `/api/plan` client with response validation |

Services never touch React state and never read `localStorage`.

### 2.4 State — `src/context/` and `src/hooks/`

`AppContext` is the single source of truth for UI state:

```
profile           localStorage("vayu.profile.v1")    Zod-validated
location          localStorage("vayu.location.v1")   Zod-validated, 2-dp coordinates
checklists        localStorage("vayu.checklist.v1")  { "YYYY-MM-DD": [recommendationId] }
onboarded         localStorage("vayu.onboarded.v1")  boolean
air               useAirQuality(location)            provider data, never persisted
planner           useMemo(buildPlanner(...))         derived, never persisted
```

Derived values (planner, checklist for today) are memoised rather than stored. `resetAllData()` clears every
key and restores in-memory defaults.

`useAirQuality` owns the async lifecycle:

- one request per location change, with a monotonically increasing `requestId` so stale responses are dropped
- `loading` for the first fetch, `refreshing` for manual/auto refresh
- failure keeps the previous snapshot, sets `isStale`, and surfaces a banner
- failure with no previous data sets an explicit "no estimate substituted" error
- 15-minute auto-refresh, skipped while the tab is hidden

### 2.5 Presentation — `src/components/` and `src/pages/`

`AppShell` provides the sidebar, mobile off-canvas menu, skip link, top bar with location control and current
category, plus the location and onboarding dialogs. Pages are route-level and lazy-loaded except the
dashboard.

Shared components:

- `AqiBadge` — category + number + colour, never colour alone; explicit unavailable state
- `DataProvenance` — provider note (with stale variant) and the separate official-observation card
- `DayTimeline` — the dashboard's "what happens today" row: now, cleaner window, higher-pollution window,
  each with an explicit unavailable state when the hourly series cannot support it
- `Modal` — native `<dialog>`, `showModal()`/`close()`, `aria-labelledby`, Escape handling
- `LocationSearch` — city search, geolocation with permission errors, manual lat/lon, popular cities
- `ProfileForm` — household and lifestyle sections, reused by onboarding and settings
- `ErrorBoundary` — catches render failures, never logs household data

The dashboard is ordered by decision value, not by data type: priority headline → the day's three windows →
the three actions → household reasoning → the raw pollutant/weather cards → provenance. The number is evidence
for the advice, never the headline.

### 2.6 Edge functions — `api/`

All four handlers use the Web `Request`/`Response` API and export
`const config = { runtime: 'nodejs', maxDuration: … }`.

```
Request → rate limit → method check → body size check → JSON parse → Zod validate
        → (configured?) provider call with timeout → Zod validate
        → validated response  |  labelled fallback
```

`api/_lib/rateLimit.ts` is a fixed-window counter keyed by `x-forwarded-for`, with opportunistic eviction when
the bucket map grows past 2,000 entries. `api/_lib/adapter.ts` bridges the Fetch-style handlers to Vercel's
Node `(req, res)` runtime. `api/_lib/gemini.ts` owns the shared AI deadline and the single retry for transient
provider overload, so `/api/chat` and `/api/plan` cannot drift apart.

---

## 3. Rendering and performance

- `React.lazy` + `Suspense` for every route except the dashboard. Production output:

| Chunk | Raw | Gzip |
| --- | --- | --- |
| `index` (app shell + dashboard) | ~404 kB | ~126 kB |
| `AirQuality` (Recharts) | ~443 kB | ~124 kB |
| other pages | 0.5–11 kB each | 0.3–4.7 kB each |

- The charting library is isolated in the AirQuality chunk, so Recharts is not downloaded until the user opens
  the air-quality page (or the lazy route is prefetched).
- Provider responses are cached for 10 minutes per rounded coordinate, so navigating between pages does not
  re-hit Open-Meteo.
- Images: none. Icons are tree-shaken from `lucide-react`. Fonts are system fonts, so there is no font request.
- `ScrollToTop` resets scroll on navigation.

---

## 4. Error and empty states

Every async surface has three explicit states, and the empty state never contains a number:

| Surface | Loading | Success | Failure |
| --- | --- | --- | --- |
| Model data | skeleton + location copy | AQI card + provenance | banner with reason and "Try again"; stale data marked |
| Weather | omitted | temperature, humidity, wind | "Weather data is unavailable" (AQI still shown) |
| Official data | n/a | published AQI, or the station's published concentrations | reason string, e.g. "not configured" or "rate-limiting this API key" |
| AI chat | "preparing guidance…" | answer + sources | deterministic answer labelled as fallback |
| AI plan | button spinner | sections + sources | `source: 'unavailable'` with reason; deterministic plan remains |
| Geocoding | "Searching…" | result list | message with manual-coordinate alternative |

A top-level `ErrorBoundary` catches render crashes. Provider failures never crash the app.

---

## 5. Design system

`src/index.css` contains the whole visual system: tokens (`--forest`, `--sage`, `--cream`, `--line`, …),
layout, components and responsive rules. Tailwind v4 is installed and imported at the top of the file, but
component styling is written in the custom CSS layer; do not mix paradigms gratuitously.

Breakpoints: 1050 px (two-column → single column for dense grids) and 760 px (sidebar becomes off-canvas,
dialogs go full width, chips and stat pills hide). `prefers-reduced-motion` disables all animation.

---

## 6. Extension points

- **Add a provider**: implement a service returning the existing snapshot types, validate with Zod, add the
  domain to `connect-src` in `vercel.json`, and keep model/official separation intact.
- **Add a page**: create `src/pages/X.tsx`, lazy-import it in `src/App.tsx`, add a nav item in `AppShell`.
- **Add a recommendation**: append to `buildPlanner` with every required field, and add an assertion to
  `recommendationService.test.ts` for its trigger condition.
- **Add an impact factor**: export it with a version constant and an explicit assumption list; never add a
  number without a stated source and uncertainty.

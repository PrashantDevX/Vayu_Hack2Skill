# Testing

---

## 1. Commands

```bash
npm test               # Vitest, single run
npm run test:watch     # watch mode
npm run test:coverage  # v8 coverage, thresholds enforced
```

Expected on `main`:

```
Test Files  19 passed (19)
Tests      105 passed (105)
```

---

## 2. Layout and configuration

- Config: `vitest.config.ts` — `jsdom` by default, `src/test/setup.ts` as the setup file, tests discovered
  under `src/**/*.test.{ts,tsx}` and `api/**/*.test.ts`.
- API tests declare `/* @vitest-environment node */` at the top because `Request`/`Response` handlers do not
  need a DOM and load faster without one.
- Tests live next to the code they cover.
- `src/test/setup.ts` polyfills `<dialog>` (`showModal`/`close` + `close` event), stubs `scrollTo`, clears
  `localStorage` and unstubs globals after every test.

---

## 3. Coverage

Measured 2026-11-18 over `src/utils`, `src/services`, `src/constants` and `api`:

| Metric | Result | Threshold |
| --- | --- | --- |
| Statements | 92.73% (651/702) | 90% |
| Branches | 81.10% (528/651) | 78% |
| Functions | 94.01% (110/117) | 92% |
| Lines | 95.81% (573/598) | 93% |

Per-module highlights:

| File | Statements | Branches |
| --- | --- | --- |
| `api/aqi.ts` | 90.3% | 86.2% |
| `api/chat.ts` | 92.7% | 71.7% |
| `api/plan.ts` | 83.0% | 65.9% |
| `src/services/aqiService.ts` | 92.3% | 74.5% |
| `src/services/geocodingService.ts` | 100% | 100% |
| `src/services/http.ts` | 95.1% | 90.0% |
| `src/utils/aqi.ts` | 92.2% | 84.3% |
| `src/utils/impact.ts` | 98.4% | 98.2% |
| `src/constants/aqi.ts` | 100% | 100% |

Thresholds are deliberately a little below the measured numbers so honest small refactors do not fail the
build, while a real regression does. The gate covers logic modules, not page markup: page behaviour is covered
by the integration test instead.

`coverage/` is generated and should not be committed.

---

## 4. What each suite protects

### 4.1 AQI maths — `src/utils/aqi.test.ts` (12 tests)

- every category boundary, including the off-by-one edges (50/51, 100/101, 200/201, 300/301, 400/401);
- invalid input rejection (negative, `NaN`, `Infinity`);
- interpolation at breakpoints and midpoints for PM2.5, PM10, NO₂, CO;
- beyond-scale values capped at 500 and flagged;
- **maximum sub-index, not average**;
- insufficient coverage (<3 pollutants) → no AQI and a reason;
- no particulate → no AQI and a reason;
- missing pollutants stay `null` and are counted as unavailable;
- formatting of µg/m³ vs mg/m³ precision.

This suite is the reason a reviewer can trust the number: it fails if the methodology drifts.

### 4.2 Impact maths — `src/utils/impact.test.ts` (12 tests)

- annual/weekly/monthly transport arithmetic against hand-computed values;
- metro-vs-car comparison returns a range with `low < value < high`;
- carpool divides the car factor by occupancy;
- walking/cycling returns zero direct emissions;
- invalid distance/days/occupancy throw instead of producing a number;
- exposure proxy multiplication and null propagation;
- windowed exposure sums reject incomplete hourly data;
- CADR sizing for normal and vulnerable households, with invalid-room rejection;
- budget ordering;
- legacy helper stays deterministic.

### 4.3 Planner — `src/services/recommendationService.test.ts` (11 tests)

- window search picks the actual lowest/highest 2-hour window from supplied values;
- windows with missing AQI are skipped; no candidates → `null`;
- every recommendation has an id, title, action, explanation, environmental context, beneficiaries,
  limitations and sources;
- school, elderly and outdoor-worker actions appear only when the profile warrants them;
- elevated AQI → "keep windows closed"; clean air → "cleaner morning window";
- no ozone recommendation, and ventilation stays conditional;
- insufficient coverage → plan still exists, no invented AQI, no "AQI 0";
- deterministic brief is labelled unavailable rather than pretending to be AI;
- category → section-title mapping.

### 4.4 Services

| File | Focus |
| --- | --- |
| `aqiService.test.ts` (8) | CO µg→mg conversion, hourly start index and labels, weather failure isolation, missing weather fields staying `null` instead of `0`, official separation, cache keyed on rounded coordinates, force refresh, malformed payload errors, insufficient hourly coverage |
| `http.test.ts` (5) | success parse, 4xx not retried, invalid/empty body, timeout abort, 5xx retry then success |
| `cache.test.ts` (3) | TTL expiry, original fetch timestamp preserved, delete, coordinate key |
| `geocodingService.test.ts` (5) | normalisation, short-query short-circuit, missing results, cache + encoding, unexpected payload/error |
| `chatService.test.ts` (5) | fallback intents use real context, missing AQI admitted, valid Gemini response accepted, request contains no name, fallback on 503/invalid shape |
| `planService.test.ts` (2) | validated brief accepted, `unavailable` on failure/empty |

### 4.5 API handlers

| File | Focus |
| --- | --- |
| `api/chat.test.ts` (6) | deterministic fallback without a key; 405/400/413 paths; rate limit returns 429 without leaking the key name or value; mocked Gemini success produces a validated answer and a bounded `<user_question>` prompt; empty/malformed/unparseable/thrown output all fall back |
| `api/plan.test.ts` (5) | unavailable without a key; 405/400; rate limit; mocked success with enum titles and prompt constraints; invented section title rejected, empty and thrown responses produce specific reasons |
| `api/aqi.test.ts` (6) | unconfigured provider; city required; method check; official record normalisation; station-distance pass-through with sanity bounds; invalid distance dropped; pollutant-only record rejected; provider failure; per-city caching |
| `api/health.test.ts` (2) | flags reflect configuration; response never contains the secret value |
| `api/lib/rateLimit.test.ts` (3) | window allow/block/retry, reset and key isolation, forwarded-header key derivation |

### 4.6 Content guards — `src/constants/alternatives.test.ts` (4 tests)

- all required fields non-empty for every household and community alternative;
- ids unique;
- **no kg/tonne figure** may appear in the qualitative avoided-emissions text;
- no ozone recommendation, no "burn your waste" advice, and composting is present.

This is a fabrication guard: it fails if someone later adds an unsupported number.

### 4.7 Integration and components

- `src/App.test.tsx` (3 tests) renders the app against a mocked Open-Meteo payload and asserts the computed
  estimate appears, the "not an official CPCB station reading" wording is present, no removed demo persona is
  rendered, the AI entry point exists, onboarding appears for a first-time user, all seven nav routes are
  present, and the sustainable-alternatives tab is reachable with no fabricated kilogram figures.
- `src/components/AqiBadge.test.tsx` (2 tests) asserts category + number + colour class, and the explicit
  unavailable state.

---

## 5. Test data policy

All fixtures are synthetic but structurally faithful to the real provider payloads (same field names, same
units). Tests assert that the app *derives* values from fixtures; no fixture is ever presented as a real
observation. There are no snapshot files, so formatting changes cannot silently bless a wrong value.

---

## 6. What is not covered

- **No end-to-end browser tests.** There is no Playwright/Cypress suite, so real navigation, focus order and
  responsive layout are verified manually (see `DEMO_GUIDE.md`).
- **No live provider contract tests.** If Open-Meteo changes its schema, tests still pass and the app shows an
  explicit "unexpected payload" state. Add a scheduled smoke test against the deployed URL to catch this
  earlier.
- **No real Gemini calls in CI.** The SDK is mocked; prompt quality is evaluated manually.
- **No Lighthouse or axe run in this repository.** Accessibility is implemented and manually checked, but not
  machine-audited here.
- **Rate limiting and caching are per-process**, so multi-instance behaviour is not exercised.

---

## 7. Writing a new test

1. Put it next to the module: `foo.ts` → `foo.test.ts`.
2. Prefer behaviour over implementation: assert the returned value or rendered text, not internal calls.
3. Mock the network with `vi.stubGlobal('fetch', …)`; the setup unstubs it automatically.
4. For API handlers, add `/* @vitest-environment node */` and reuse `clearRateLimits()` in `beforeEach`.
5. If you assert "no fabrication", assert on the rendered/returned string (e.g. `not.toMatch(/\d+\s*kg/)`).
6. Keep the coverage gate green; if a new branch is genuinely untestable, document why in the PR rather than
   lowering the threshold.

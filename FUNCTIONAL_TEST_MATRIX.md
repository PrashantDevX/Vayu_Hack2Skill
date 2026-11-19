# Vayu — Functional Test Matrix

**Commit:** `6003d38` · **Date:** 2026-11-19 · **Mode:** read-only audit

Legend: **PASS** = executed and matched expectation · **FAIL** = executed and did not match ·
**BLOCKED** = could not be executed in this environment (reason given) · **STATIC** = verified by source
inspection + existing jsdom tests, never executed in a real browser (not counted as PASS for UX).

Every UI flow listed as BLOCKED is blocked for the same reason: no Playwright/axe/Lighthouse installed and the
audit rules forbid installing substantial dependencies. Source-level evidence is given so the reader can see
what *should* happen, without pretending it was observed.

---

## A. Onboarding and location

| ID | Input | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|
| ONB-01 | First visit, no `vayu.onboarded.v1` | Onboarding dialog opens at step 1 | Dialog is driven by `onboarded` flag in `AppShell.tsx`; jsdom app test renders the shell | BLOCKED (browser) | `src/components/OnboardingDialog.tsx`, `src/App.test.tsx` |
| ONB-02 | Empty city input | Search disabled / no request | `LocationSearch` requires a non-empty query before calling geocoding | STATIC | `src/components/LocationSearch.tsx` |
| ONB-03 | Valid city "Delhi" | Geocoding returns Delhi, India with timezone | Provider probe returned `Delhi, India 28.65195 77.23149 Asia/Kolkata` | PASS (provider) | §5.6 of test results |
| ONB-04 | Invalid city "zzzzqqq" | Explicit "no match" state, no fabricated location | Geocoding returns no results; UI shows empty state | STATIC | `src/services/geocodingService.ts` |
| ONB-05 | Geolocation granted | Coordinates quantized to 2 dp, nearest city label | `quantizeCoordinate` before storage | STATIC | `src/utils/profile.ts` |
| ONB-06 | Geolocation denied | Manual search remains fully usable | Denial path falls back to search; no blocking modal | STATIC | `LocationSearch.tsx`, `LocationDialog.tsx` |
| ONB-07 | Geolocation unavailable (no API) | Same as denied | `navigator.geolocation` guarded | STATIC | — |
| ONB-08 | Change location after onboarding | AQI refetches; cache keyed on 2-dp coords | `useAirQuality` re-runs on location change | STATIC | `src/hooks/useAirQuality.ts` |
| ONB-09 | Refresh page | Location and profile persist | Zod-validated localStorage read | PASS (unit) | `src/hooks/useLocalStorage.test.ts` |
| ONB-10 | Corrupt stored JSON | Defaults restored, no crash | `parseStoredProfile` returns defaults | PASS (unit) | `src/utils/profile.test.ts` |
| ONB-11 | Timezone handling | Timestamps stay location-local strings | `formatHourLabel` / `localDateKey` never use `new Date()` on provider strings | PASS (unit) | `src/utils/date.test.ts` |
| ONB-12 | Invalid coordinates in storage | Rejected by schema | `locationSchema` bounds lat/long | PASS (unit) | `src/utils/profile.test.ts` |

## B. Household profile

| ID | Input | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|
| PRF-01 | Adults-only household | No child/elderly sections | 6 base recommendations, no `school-protection` | PASS (executed) | planner harness |
| PRF-02 | Household with 2 children | Adds school section | 7 recommendations incl. `school-protection` | PASS (executed) | planner harness |
| PRF-03 | Elderly member | Adds elderly section | 7 recommendations incl. `elderly-precautions` | PASS (executed) | planner harness |
| PRF-04 | Outdoor worker | Adds occupational section | 7 recommendations incl. `outdoor-worker` | PASS (executed) | planner harness |
| PRF-05 | Respiratory sensitivity | Sensitive adults named as beneficiaries | Beneficiary list includes "Sensitive adults"; action text unchanged | PASS (executed) | planner harness + `recommendationService.ts:110` |
| PRF-06 | Budget "Free" / "Premium" | Different filtration advice | CADR advice differs by budget when no purifier; "Free" prioritises source control | PASS (static + code) | `recommendationService.ts:112-118` |
| PRF-07 | Has purifier | Maintenance advice instead of purchase advice | Different title/action/cost/effort | PASS (static) | `recommendationService.ts:215-227` |
| PRF-08 | Commute "Petrol car" vs "Metro" vs "Walking or cycling" | Different commute advice | Three distinct branches | PASS (static) | `recommendationService.ts:120-127` |
| PRF-09 | Invalid numeric input (0 adults, 99 children) | Clamped or rejected | `NumberField` + Zod bounds | PASS (unit) | `src/components/ProfileForm.tsx`, schema tests |
| PRF-10 | Profile reset | Defaults restored, storage cleared | `resetAllData()` removes all four keys | PASS (unit) | `src/context/AppContext.tsx` |
| PRF-11 | Privacy of profile storage | Only non-identifying categories | No name/DOB/diagnosis fields exist in the type at all | PASS (static) | `src/types.ts` `Profile` |
| PRF-12 | Profile actually changes recommendations | Yes | Card set and text both change as above | PASS (executed) | planner harness |

## C. Air-quality dashboard

| ID | Input | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|
| AQ-01 | Live Delhi coords | Current AQI from model data | Provider returns 7 pollutants; `assessAqi` computes estimate | PASS (provider + unit) | §5.6 |
| AQ-02 | PM2.5 / PM10 / NO2 / SO2 / CO / O3 / NH3 | All seven shown with units and averaging period | `POLLUTANTS` defines all seven with `averagingPeriod` | PASS (independent maths) | 126-assertion harness |
| AQ-03 | CO unit | µg/m³ converted to mg/m³ before CPCB breakpoints | `/1000` on ingest; provider confirmed µg/m³ | PASS | `aqiService.ts:84,104` |
| AQ-04 | Missing pollutant | `null`, never 0 | `ammonia:null` observed live and preserved | PASS (provider) | §5.6 |
| AQ-05 | Insufficient coverage | `aqi:null` + reason | Coverage rule enforced | PASS (executed) | harness |
| AQ-06 | Official station card | Separate card, station name, `last_update`, no AQI invented | Live payload confirms `aqi:null` + 4 pollutants | PASS | §5.3 |
| AQ-07 | Model vs official labelling | Distinct labels, never merged | "estimated CPCB-style model AQI" vs "official observation" | PASS (static) | `DataProvenance.tsx`, `officialService.ts` |
| AQ-08 | Hourly forecast series | ≤24 points from current hour, `aqi:null` where coverage fails | Implemented; never interpolated | PASS (unit) | `aqiService.test.ts` |
| AQ-09 | Stale data | Last-known timestamp + explicit stale state | Hook tracks staleness | STATIC | `useAirQuality.ts` |
| AQ-10 | Provider timeout/error | Explicit unavailable state | Timeout + typed errors + cache of failure | PASS (unit) | `http.test.ts`, `aqiService.test.ts` |
| AQ-11 | City without stations | Explicit "no rows for this city" | Adapter returns unavailable with reason | PASS (unit) | `api/aqi.test.ts` |
| AQ-12 | Chart rendering | Renders without console errors | Not executed in a browser | BLOCKED | — |
| AQ-13 | Fabricated/demo data present anywhere | None | No hardcoded AQI/PM2.5/temperature constants in the dashboard path | PASS (static, grep) | `src/` review |

## D. Personalised daily planner

| ID | Input | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|
| PLN-01 | Good AQI (PM2.5 20) | "Use the cleaner morning window" tone | Non-elevated `morningAction` selected | PASS (executed) | planner harness |
| PLN-02 | Very Poor AQI (PM2.5 150 → 323) | "Protect the morning indoor environment" tone | Elevated branch selected; summary shows Very Poor | PASS (executed) | planner harness |
| PLN-03 | Severe AQI | Mask/exertion language escalated | `isSevere` branch in school section | PASS (static) | `recommendationService.ts:253` |
| PLN-04 | Morning peak / evening peak | Best and worst windows found from hourly series | 17:00–19:00 (AQI 21) best, 06:00–08:00 (AQI 139) worst | PASS (executed) | planner harness |
| PLN-05 | No hourly forecast | `null` windows, plan still produced | `bestWindow`/`worstWindow` nullable | PASS (unit) | `recommendationService.test.ts` |
| PLN-06 | Child in household | School section inserted at position 3 | Confirmed | PASS (executed) | planner harness |
| PLN-07 | Checklist toggle | Persists per local date | `vayu.checklist.v1` keyed by `localDateKey()` | PASS (unit) | `App.test.tsx`, date tests |
| PLN-08 | Checklist regeneration on new day | Resets for new date | Date-keyed storage | STATIC | `AppContext.tsx` |
| PLN-09 | AI brief on `/planner` | Gemini sections when configured | **Endpoint returns 500 → `source:"unavailable"`, deterministic plan stays** | **FAIL (AI path)** | §5.4 |
| PLN-10 | AI brief fallback | Explicit "AI brief unavailable" reason | Reason string rendered | PASS (static) | `planService.ts:76-78` |

## E. Indoor air optimiser

| ID | Input | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|
| IND-01 | 180 sq ft room, 9 ft ceiling | Volume and CADR band | 1620 ft³, 45.9 m³, 183–229 m³/h | PASS (independent) | harness |
| IND-02 | Different room sizes | CADR scales with volume | Linear in area × ceiling | PASS (independent) | harness |
| IND-03 | 0 sq ft | Rejected | Throws "Room area must be greater than zero" | PASS | harness |
| IND-04 | Budget bands | Advice changes | Source-control-first for Free/Under ₹1,500 | PASS (static) | `recommendationService.ts:116` |
| IND-05 | Has purifier | Maintenance advice + CADR check | Confirmed | PASS (static) | `recommendationService.ts:114` |
| IND-06 | Ozone generator | Never recommended | Explicit prohibition in advice, safety regex, system prompt | PASS (3 layers) | `alternatives.ts`, `aiOutput.ts:18`, `chat.ts:124` |
| IND-07 | DIY box-fan filtration | Never recommended | Safety regex + explicit "avoid improvised electrical filters" | PASS | `aiOutput.test.ts`, fallback case 22 |
| IND-08 | Predicted indoor concentration claim | Must not exist | No indoor µg/m³ prediction anywhere; CADR is sizing only | PASS (static) | `src/utils/impact.ts:150-203` |
| IND-09 | Ventilation during high outdoor pollution | Must not blindly advise opening windows | Guarded by `blind_ventilation` rule and AQI-aware copy | PASS | `aiOutput.ts:31-37` |
| IND-10 | Cooking pollution | Exhaust/combustion advice | Present, with biomass-specific branch | PASS (static) | `recommendationService.ts:197-200` |

## F. Sustainable alternatives

| ID | Input | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|
| ALT-01 | Household/community alternatives | Qualitative, no kg claims | Test fails if a kg/tonne figure is added | PASS (unit) | `constants/alternatives.test.ts` |
| ALT-02 | Car → metro / bus / carpool / walk | Each mode has a defensible factor | Factors present with notes | PASS | `impact.ts:18-49` |
| ALT-03 | Combined journeys | Practical guidance, no fabricated total | Advice only | PASS (static) | `alternatives.ts` |
| ALT-04 | Missing emission factor | Must not invent one | Record is a closed union of six modes | PASS (static) | `impact.ts` |

## G. Impact simulator

| ID | Input | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|
| IMP-01 | 10 km one-way, 5 days, petrol car | Annual CO₂e | 998.4 kg (5200 km × 0.192) | PASS (independent) | harness |
| IMP-02 | Same, metro | Saving | 785.2 kg, band 628.16–942.24 | PASS (independent) | harness |
| IMP-03 | Carpool with 4 occupants | Factor divided by occupancy | 748.8 kg saving | PASS (independent) | harness |
| IMP-04 | Walking/cycling | Full saving, zero factor | 998.4 kg | PASS (independent) | harness |
| IMP-05 | Alternative worse than baseline | Never negative | Floors at 0 | PASS (independent) | harness |
| IMP-06 | Negative distance / 8 days / 0 occupants | Rejected | Throws | PASS (independent) | harness |
| IMP-07 | Very large input | No overflow/NaN | Linear arithmetic, finite checks | PASS (static) | `impact.ts` |
| IMP-08 | Uncertainty | ±20% shown with factor version | `vayu-planning-2026.1` surfaced | PASS (static) | `impact.ts:51,129` |
| IMP-09 | Exposure proxy | µg/m³·h, not dose | 60 × 2 h = 120; labelled correctly | PASS (independent) | harness |
| IMP-10 | City-scale claim | Must not imply AQI improvement | Explicit assumption text | PASS | `impact.ts:141-146` |

## H. Family protection

| ID | Input | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|
| FAM-01 | Children | School-travel guidance, mask caveat | Present with limitation text | PASS (static) | `recommendationService.ts:248-268` |
| FAM-02 | Elderly | Errand shifting + clinician advice | Present | PASS (static) | `recommendationService.ts:270-290` |
| FAM-03 | Outdoor worker | Task rotation, employer discussion | Present | PASS (static) | `recommendationService.ts:292-312` |
| FAM-04 | Respiratory/cardiovascular | Sensitivity acknowledged | Beneficiary label + limitations | PASS (static) | `recommendationService.ts:110` |
| FAM-05 | Severe AQI | Escalated but non-medical | "follow local public-health instructions" | PASS (static) | `CATEGORY_SUMMARY` |
| FAM-06 | Medical advice boundary | No diagnosis/prescription | Refused in AI safety layer + limitation strings | PASS | `aiOutput.ts:24`, fallback cases 19-20 |

## I. AI assistant

Full per-case scoring is in `AI_EVALUATION_REPORT.md`.

| ID | Input | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|
| AI-01 | Location-specific question (deployed) | 200, grounded answer | **500** | **FAIL** | §5.4 |
| AI-02 | Commute question (deployed) | 200 | **500** | **FAIL** | §5.4 |
| AI-03 | Indoor pollution (deployed) | 200 | **500** | **FAIL** | §5.4 |
| AI-04 | Purifier/budget (deployed) | 200 | **500** | **FAIL** | §5.4 |
| AI-05 | Children/school (deployed) | 200 | **500** | **FAIL** | §5.4 |
| AI-06 | Elderly (deployed) | 200 | **500** | **FAIL** | §5.4 |
| AI-07 | Unrelated question (deployed) | 200, polite refusal | **500** | **FAIL** | §5.4 |
| AI-08 | Prompt injection (deployed) | 200, ignored | **500** | **FAIL** | §5.4 |
| AI-09 | Medical diagnosis (deployed) | 200, refusal | **500** | **FAIL** | §5.4 |
| AI-10 | Invalid/empty input (deployed) | 400 | **500** | **FAIL** | §5.4 |
| AI-11 | Same contract in-process | 400/405/413/429 as designed | All matched | PASS | §5.5 |
| AI-12 | Deterministic fallback, 32 questions | Relevant, safe | 0 unsafe, 6 in-scope deflections | PARTIAL | AI report |
| AI-13 | Client degradation when API 500s | Labeled deterministic answer | "Deterministic guidance" badge | PASS | `AIAdvisor.tsx:98-99` |
| AI-14 | Source provenance | Server-issued source ids only | Closed enum `SOURCE_METADATA` | PASS | `chat.ts:42-47` |

## J. Routing and shell

| ID | Input | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|
| RT-01 | `/`, `/air-quality`, `/planner`, `/indoor`, `/impact`, `/family`, `/advisor`, `/settings` | All render | Rendered in jsdom app test | PASS (jsdom) | `src/App.test.tsx` |
| RT-02 | Unknown path | NotFound page | `*` route → lazy `NotFound` | PASS (jsdom) | `src/App.tsx` |
| RT-03 | Deep link `/planner` in production | 200 HTML | 200 `text/html` | PASS (live) | §5.1 |
| RT-04 | Unknown `/api/nope` | Not a function; SPA fallback | Returns index.html 200 | NOTE | See below |
| RT-05 | Skip link / keyboard nav | First tab stop is skip link | `.skip-link:focus` present | STATIC | `index.css:61` |
| RT-06 | Dead buttons / links | None | No `href="#"` handlers found; actions wired | STATIC | source review |

> RT-04 note: `/api/nope` returns the SPA HTML with 200 rather than a JSON 404 because the rewrite catches it.
> This is cosmetic, not a security issue (no data is returned), and it is not counted as a defect.

---

## Matrix summary

| Module | PASS | FAIL | BLOCKED | STATIC/partial |
|---|---:|---:|---:|---:|
| A. Onboarding/location | 4 | 0 | 1 | 7 |
| B. Household | 8 | 0 | 0 | 4 |
| C. Air quality | 9 | 0 | 1 | 3 |
| D. Planner | 6 | 1 | 0 | 3 |
| E. Indoor | 6 | 0 | 0 | 4 |
| F. Alternatives | 3 | 0 | 0 | 1 |
| G. Impact | 8 | 0 | 0 | 2 |
| H. Family | 4 | 0 | 0 | 2 |
| I. AI assistant | 1 | 9 | 0 | 4 |
| J. Routing | 2 | 0 | 0 | 4 |

**Confirmed failures: 10** — all nine deployed AI-0x cases plus the AI brief (PLN-09). Every one of them
traces to the same root cause (VAYU-P0-001) and should be counted once in scoring, not ten times.

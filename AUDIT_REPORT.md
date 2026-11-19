# Vayu independent baseline audit

> **CORRECTION NOTICE (2026-11-19, superseded).** This document's claim that "no P0 blocker was verified"
> was wrong. An independent read-only audit of `6003d38` proved that `/api/chat` and `/api/plan` returned
> HTTP 500 on every request because of a link-time `ERR_MODULE_NOT_FOUND` on an extensionless import in
> `src/services/chatFallback.ts`. The defect has since been fixed, and the counts below are superseded:
> the suite is now 24 files / 189 tests at 94.88 / 86.36 / 97.61 / 98.23 coverage. See
> `INDEPENDENT_AUDIT_REPORT.md`, `INDEPENDENT_TEST_RESULTS.md` and `PERFORMANCE_ACCESSIBILITY_REPORT.md`.
> Treat this file as a historical record of an earlier sprint, not as current status.

## Third remediation sprint addendum (2026-11-19)

**Score:** 87/100, unchanged from the previous internal assessment. Original preserved baseline: 86/100. The fixes below are verified locally, but no new score is awarded: post-fix live Gemini quality and deployment/browser behavior were not verified, and adding code/tests alone is not scoring evidence.

**Coverage:** baseline before this sprint 85.06% branches (712/837); current 86.24% (790/916), with 94.80% statements, 97.61% functions and 98.21% lines. Coverage scope expanded with new API safety/body tests, so raw counts differ.

### Verified remediation record

| Defect | Confirmed issue and change | Modified files | Before → after evidence |
|---|---|---|---|
| VAYU-AQI-001 | CPCB breakpoint representation interpolated from continuous anchors and disagreed at published band starts. Added explicit non-overlapping concentration bands, corrected interpolation, preserved model-estimate disclosure. | `src/constants/aqi.ts`, `src/utils/aqi.ts`, `src/utils/aqi.test.ts`, `docs/DATA_METHODOLOGY.md` | PM2.5 31: old 52 → corrected 51; CO 1.1: old 55 → corrected 51; NH3 201: old 50 → corrected 51. Boundary and fractional tests pass. |
| VAYU-AI-002 | Planner had no post-generation safety/relevance checks. Shared server guard now validates chat and every plan section; unsafe/irrelevant responses use deterministic fallback or unavailable plan. | `api/_lib/aiOutput.ts`, `api/_lib/aiOutput.test.ts`, `api/chat.ts`, `api/chat.test.ts`, `api/plan.ts`, `api/plan.test.ts` | Previously a schema-valid DIY filtration completion could pass. Now varied ozone, DIY filter/fan, medical, unsupported reduction, city-AQI and blind-ventilation cases are rejected in tests. No post-fix live Gemini rate is claimed. |
| VAYU-AI-003 | Chat did not distinguish Gemini from generic server fallback; model could invent source strings. Shared intent fallback, typed source discriminator and server-owned source IDs now feed accessible trusted source links. | `src/services/chatFallback.ts`, `src/services/chatService.ts`, `src/services/chatService.test.ts`, `src/constants/sources.ts`, `src/types.ts`, `src/pages/AIAdvisor.tsx`, `src/pages/DailyPlanner.tsx`, `api/chat.ts`, `api/plan.ts`, `src/services/planService.ts`, `src/services/recommendationService.ts`, related tests | Responses now label `gemini` vs `fallback`; unknown questions get a scope response; generated citations are discarded and source metadata is server-owned. 20 deterministic fallback intent cases pass. |
| VAYU-SEC-001 | Prompt context accepted free-form fields and client-authored planner actions; body size trusted only Content-Length. Strict enums/objects/bounds, JSON-separated untrusted input, removal of browser-authored actions and bounded streaming JSON parsing added. | `api/chat.ts`, `api/chat.test.ts`, `api/plan.ts`, `api/plan.test.ts`, `api/_lib/requestBody.ts`, `api/_lib/requestBody.test.ts`, `src/services/planService.ts` | Invalid controls/injection/unknown fields return 400; oversized measured streams return 413. Embedded/fenced planner JSON is parsed safely and malformed output returns unavailable. |
| VAYU-SEC-002 | Limiter was process-local and keyed from spoofable forwarding headers. Added optional atomic Upstash Redis fixed-window counter, hashed client identity, timeout and bounded local fallback; identity reads only the Vercel-managed header. | `api/_lib/rateLimit.ts`, `api/_lib/rateLimit.test.ts`, `api/aqi.ts`, `api/chat.ts`, `api/plan.ts`, `.env.example`, `README.md`, `docs/SECURITY.md` | Local behavior, retry values, shared-command construction and outage fallback pass unit tests. No Upstash credentials/shared-instance environment was available; global enforcement remains unverified and local fallback is explicitly per-instance. |
| VAYU-REQ-001 | No byte limit for streamed requests without Content-Length. | `api/_lib/requestBody.ts`, `api/_lib/requestBody.test.ts`, `api/chat.ts`, `api/plan.ts` | Requests over 12/16 kB now return 413 before unbounded buffering; malformed JSON returns 400. |

### Current assessment and limits

- Automated verification: 180 tests / 24 files pass; typecheck, lint, build and full `npm audit` pass. Provider script passes for configured Gemini and data.gov.in. Details are in `TEST_RESULTS.md`.
- Twenty synthetic local API cases evaluate deterministic fallback behavior across all requested intent classes. They are not a post-fix Gemini quality run. Sanitized per-case rubric results are in `docs/synthetic-ai-evaluation.json`.
- The production deployment was not changed or smoke-tested. Deployment/browser checks were not run because this sprint explicitly limits them to cases where authorized; no production release authorization was given.
- Upstash cross-instance rate limiting is implemented but unconfigured and unverified. Without both Redis REST variables, the bounded limiter remains process-local.
- Current internal score remains 87/100 beside original 86/100 and previous 87/100. The 98+ target is not established by this evidence.

**Modified files:** `.env.example`, `AUDIT_REPORT.md`, `README.md`, `TEST_RESULTS.md`, `api/_lib/aiOutput.ts`, `api/_lib/aiOutput.test.ts`, `api/_lib/rateLimit.ts`, `api/_lib/rateLimit.test.ts`, `api/_lib/requestBody.ts`, `api/_lib/requestBody.test.ts`, `api/aqi.ts`, `api/chat.ts`, `api/chat.test.ts`, `api/plan.ts`, `api/plan.test.ts`, `docs/AI_DESIGN.md`, `docs/DATA_METHODOLOGY.md`, `docs/SECURITY.md`, `docs/TESTING.md`, `docs/synthetic-ai-evaluation.json`, `src/App.test.tsx`, `src/constants/aqi.ts`, `src/constants/sources.ts`, `src/pages/AIAdvisor.tsx`, `src/pages/DailyPlanner.tsx`, `src/services/chatFallback.ts`, `src/services/chatService.ts`, `src/services/chatService.test.ts`, `src/services/planService.ts`, `src/services/planService.test.ts`, `src/services/recommendationService.ts`, `src/types.ts`, `src/utils/aqi.ts`, `src/utils/aqi.test.ts`.


### Historical second sprint report

The assessment below records the second sprint state and its score rationale; the third sprint status and current verification are summarized above.

**Audit date:** 2026-11-19 (Asia/Calcutta)  
**Scope:** Initial audit plus focused follow-up remediation of the verified coverage weakness.  
**Name note:** The checked-out project identifies itself as Vayu (`package.json`, README and product docs), while the supplied brief calls it AirAware. This report evaluates the checked-out Vayu repository.  
**Score:** **87/100** (independent diagnostic estimate; not an organizer score). Original baseline: **86/100**; current: **87/100**.  
**Readiness:** Good prototype, not submission-ready (internal classification).  
**98+ distance:** 11 points. Scores are evidence-based estimates; evaluator scoring can differ.

## Executive assessment

The repository is a real modular application, not a static mockup. It has live Open-Meteo model data, an optional official-data adapter, deterministic planning and chat fallbacks, server-side Gemini handlers, input schemas, privacy controls, and meaningful unit/integration coverage. Typecheck, lint, tests, coverage thresholds and production build all pass in this environment.

At the time of the second sprint, branch coverage had reached 85.06% (712/837), and live checks passed against configured Gemini and data.gov.in, Open-Meteo data was confirmed, deployed API health/AQI/chat/plan were smoke-tested, and 20 live chat cases were run. The AI cases exposed one unsafe DIY filtration recommendation and several irrelevant/generic answers. A local response guard and regression test now reject the observed unsafe recommendation class. The deployment was not changed and does not contain this fix. Lighthouse, axe, deployed browser and geolocation-permission review remain unverified.

No P0 blocker was verified. VAYU-TST-001 is resolved at 85.06% branch coverage. Remaining P1 evidence gap is external browser verification; the AI response guard is fixed locally but awaiting a separately authorized production release.

> **Superseded (2026-11-19):** a later independent audit proved this statement wrong — a P0
> (`ERR_MODULE_NOT_FOUND` taking down `/api/chat` and `/api/plan`) was real and has since been fixed.
> See the correction notice at the top of this file.

## Weighted score

| Dimension | Max | Awarded | % | Evidence and rationale |
|---|---:|---:|---:|---|
| Problem Statement Alignment | 15 | 14 | 93% | Location, household, routine, indoor, transport, impact and community alternatives are represented in `src/pages/*`, `src/constants/alternatives.ts`; qualitative impact safeguards in `src/utils/impact.ts`. User testing during a real severe-smog event was not available. |
| Functional Completeness | 20 | 17 | 85% | Routes/integrations in `src/App.tsx`, `src/context/AppContext.tsx`, `src/services/*`, `api/*`; local and deployed API checks pass. Browser workflows remain unverified. |
| GenAI Quality and Personalization | 15 | 12 | 80% | 20 live synthetic chat cases returned schema-valid answers but mixed relevance; one violated safety rules. `api/chat.ts` now blocks that pattern locally. The fix is not deployed. See `docs/live-ai-evaluation.json`. |
| Environmental Data Accuracy and Reliability | 15 | 14 | 93% | CPCB-style interpolation, max-subindex, coverage and beyond-scale handling in `src/constants/aqi.ts`, `src/utils/aqi.ts`; model and official data separated in `src/services/aqiService.ts`, `src/services/officialService.ts`. Provider source units/timestamps and live operation not independently confirmed here. |
| Code Quality and Architecture | 10 | 9 | 90% | Modular services/context/pages, TypeScript and schema validation; `npm run typecheck` and `npm run lint` pass. Some route payload is substantial and branch coverage remains under target. |
| Security and Privacy | 10 | 9 | 90% | Server-only secrets, bounded/validated API inputs, rate limits and Vercel headers documented/implemented. Deployed headers verified; Git-history secret scan unavailable. |
| Testing and Reliability | 5 | 5 | 100% | 22 files / 144 tests pass; coverage 95.02% statements, 85.06% branches, 97.27% functions, 97.88% lines. |
| Performance and Efficiency | 5 | 4 | 80% | Build succeeds; initial JS 407.06 kB (126.93 kB gzip), AirQuality route chunk 443.30 kB (124.24 kB gzip), other routes lazy loaded. No Lighthouse/network profiling. |
| Accessibility and UX | 5 | 3 | 60% | Semantic labels, responsive rules, skip link and reduced-motion code are present. No axe/browser/manual screen-reader verification; therefore accessibility is only partially established. |
| **Total** | **100** | **87** | **87%** | One point reflects the met coverage target and regression-protected local safety guard. Not an official Hack2Skill result. |

## Challenge 6 requirement mapping

| Requirement | Classification | Implementation evidence and limitation |
|---|---|---|
| A. Location-aware air intelligence | Implemented, partially verified | `src/components/LocationSearch.tsx`, `src/components/LocationDialog.tsx`, `src/services/geocodingService.ts`, `src/services/aqiService.ts`; live provider and browser permission matrix not run. |
| B. Family/lifestyle personalization | Implemented and locally tested | `src/components/ProfileForm.tsx`, `src/utils/profile.ts`, `src/context/AppContext.tsx`; preferences are local and bounded. Current working edits add editable numeric input behavior. |
| C. GenAI daily recommendations | Implemented with deterministic fallback | `api/plan.ts`, `api/_lib/gemini.ts`, `src/services/planService.ts`, `src/services/recommendationService.ts`; live model cases untested. |
| D. Indoor improvement | Implemented | `src/pages/IndoorAir.tsx`, `src/utils/impact.ts`, `src/constants/alternatives.ts`; no indoor sensor or predicted concentration, appropriately disclosed. |
| E. Low-emission routines | Implemented | `src/services/recommendationService.ts`, `src/pages/DailyPlanner.tsx`; checklist stored locally. Full behavior matrix not manually run. |
| F. Sustainable transport | Implemented | `src/utils/impact.ts`, `src/pages/ImpactSimulator.tsx`; numeric factors and uncertainty are centralized. |
| G. Transparent impacts | Implemented with bounded claims | `src/utils/impact.ts`, `src/constants/alternatives.ts`; personal CO2e is distinct from ambient concentration/exposure and household alternatives are qualitative. |
| H. Community solutions | Implemented as qualitative guidance | `src/constants/alternatives.ts` and planner/impact UI; no measured community outcome claim. |
| I. Accessibility/ease | Partially verified | `src/components/AppShell.tsx`, form labels, keyboard-oriented controls and CSS media/reduced-motion rules; no axe or assistive-tech evaluation. |
| J. Severe-event usability | Partially implemented, unverified in field | `src/pages/Dashboard.tsx`, `src/pages/FamilyProtection.tsx`, `src/pages/DailyPlanner.tsx`; no live event simulation or user study. |

## Findings

### P1 — VAYU-TST-001: Branch coverage still misses the requested audit target

- **Severity:** P1 scoring weakness; no production failure demonstrated.
- **Affected files:** API test suites (`api/**/*.test.ts`), `src/services/**/*.test.ts`, `src/utils/**/*.test.ts`.
- **Evidence:** Sprint baseline **81.67% (682/835)**; current **85.06% (712/837)**. The requested 85% target is met.
- **Expected:** At least 85% meaningful branch coverage across core calculations, provider failures and API validation paths.
- **Actual after fix:** 85.06%; 144 tests pass.
- **Remediation performed:** Added behavior assertions in `src/utils/date.test.ts`, `src/services/recommendationService.test.ts`, `api/plan.test.ts`, and `api/_lib/rateLimit.test.ts`. Coverage improved by 30 covered branches with 2 additional instrumented branches. This is measured; no assertion-free tests were added.
- **Evaluation impact:** Testing/reliability and potentially the related functional dimensions.

### RESOLVED locally — VAYU-AI-002: Unsafe DIY filtration recommendation

- **Severity:** High safety defect; local source fix only, deployment pending.
- **Affected files:** `api/chat.ts`, `api/chat.test.ts`.
- **Evidence:** Live synthetic case `purifier-budget` in `docs/live-ai-evaluation.json` suggested a DIY box-fan/MERV filter assembly despite explicit prompt prohibition.
- **Expected:** Never return actionable unsafe DIY electrical filtration guidance, including when output is valid JSON.
- **Actual before fix:** Schema accepted unsafe text. One of 20 live samples contained the recommendation.
- **Change:** Added targeted output-pattern rejection which selects existing deterministic fallback; added regression test.
- **After verification:** Test and coverage suite passes. Public deployment has not been changed and still requires release and smoke verification.
- **Evaluation impact:** AI safety; the conservative score change also reflects achievement of the branch target.

### P1 — VAYU-VER-001: Live provider, live AI, deployment, and field UX evidence is unavailable

- **Severity:** P1 verification gap (not a proven code defect).
- **Affected files/surfaces:** `api/aqi.ts`, `api/chat.ts`, `api/plan.ts`, deployed Vercel functions and browser UI.
- **Evidence:** Provider checks and production API smoke tests now pass; 20 live synthetic chat responses are recorded. Lighthouse, axe, browser critical flows and geolocation permissions were not run.
- **Expected:** Clearly recorded real-provider and deployed checks, or explicit blocked status when credentials/quota/browser infrastructure are unavailable.
- **Actual:** Live providers and deployed API smoke checks were exercised; browser/accessibility/performance items remain **UNVERIFIED/BLOCKED**, not passed.
- **Remediation:** Run deployed browser checks, axe, Lighthouse and manual keyboard/geolocation flows when browser infrastructure is available.
- **Evaluation impact:** Functional completeness, AI, performance, accessibility and reliability confidence.

### P2 — VAYU-PERF-001: Route chunk exceeds initial bundle and would benefit from profiling

- **Severity:** P2 optimization opportunity; no poor user timing measured.
- **Affected files:** `src/pages/AirQuality.tsx` and its chart imports.
- **Evidence:** `npm run build` reports initial JS 407.06 kB / 126.93 kB gzip and AirQuality lazy chunk 443.30 kB / 124.24 kB gzip. Routes are lazy loaded in `src/App.tsx`.
- **Expected:** Measured route loading and interaction performance on target devices, with optimization guided by profiling.
- **Actual:** Bundle sizes are measured; runtime performance is unmeasured.
- **Remediation:** Profile before code splitting chart features or changing dependencies; preserve route functionality.
- **Evaluation impact:** Performance/efficiency.

### P2 — VAYU-A11Y-001: Accessibility conformance is not verified by automated/manual tooling

- **Severity:** P2 verification gap.
- **Affected files:** Application routes and components under `src/`.
- **Evidence:** No axe dependency or browser accessibility results found in the repository or audit runs. Semantic labels and focus styles are code evidence only.
- **Expected:** Automated axe checks and keyboard/mobile/screen-reader review with documented findings.
- **Actual:** Browser-level accessibility is unverified.
- **Remediation:** Run axe and manual keyboard/focus/contrast/reduced-motion checks on critical flows; fix concrete failures and add durable regression tests where practical.
- **Evaluation impact:** Accessibility and UX.

## P0–P3 remediation status and remaining work

| Priority | Item | Score affected | Why it matters | Expected gain | Change and likely files | Verification |
|---|---|---|---|---|---|---|
| P0 | None verified | — | Source review, local checks and API smoke tests found no confirmed blocker. | None claimed | None. | Continue normal monitoring. |
| P1 | VAYU-TST-001: raise meaningful branch coverage to 85% | Testing, reliability | Audit target was unmet. | Resolved: 81.67% to 85.06%; dimension 4/5 to 5/5. | Added edge-case tests in date, planner, plan API and rate-limit suites. | Coverage report: 85.06%, 144 tests. |
| P1 | VAYU-AI-002: reject unsafe DIY filtration output | AI safety | Live model contradicted explicit safety instruction. | Fix is evidence-backed; no guarantee beyond this response class. | `api/chat.ts`, `api/chat.test.ts`. | Live sample and local regression test; deployment remains unchanged. |
| P1 | VAYU-VER-001: complete external UX/performance verification | Functional, UX, performance | Providers and APIs are verified; browser-critical flows are not. | Not estimated. | No speculative source changes. | axe, Lighthouse and manual browser flows when available. |
| P2 | VAYU-A11Y-001: verify accessibility | UX | Current code alone cannot establish usable contrast, focus flow or screen-reader experience. | Small/moderate; unestimated | Fix only observed problems in affected `src/components/*`/pages. | axe plus keyboard and viewport checks. |
| P2 | VAYU-PERF-001: profile route loading | Performance | AirQuality chunk is 443.30 kB; no runtime measurements show user impact yet. | Unestimated | Profile chart usage in `src/pages/AirQuality.tsx`; only optimize evidence-backed hotspots. | Lighthouse/network profile on deployed app. |
| P3 | Audit artifact/report maintenance | Maintainability | Preserve traceability between audit and results. | No direct score claim | Keep `AUDIT_REPORT.md`, `TEST_RESULTS.md` aligned with actual runs. | Review commands, outcomes and dates. |

### Five changes most likely to improve real evaluation quality

1. Run deployed browser flows and axe/Lighthouse; these remain unverified.
2. Improve AI relevance and add deterministic intent-specific handling for generic/off-topic live responses.
3. Release the local unsafe-output guard only through the normal authorized production process, then retest public API safety.
4. Run axe and manual keyboard/focus/mobile checks; fix observed defects.
5. Profile the large AirQuality route before considering performance changes.

## Security and privacy review

Code review of `api/*`, `src/utils/profile.ts`, `src/services/chatService.ts`, `src/services/planService.ts`, `.gitignore`, `vercel.json`, and `docs/SECURITY.md` found server-side provider credentials, bounded request schemas, text rendering, local preference storage, coordinate quantization, rate limits, timeouts and response security headers. No secret values were printed or placed in this report. `npm audit --omit=dev` reports zero production dependency vulnerabilities.

**Not performed:** full Git-history secret scanning (scanner unavailable), external penetration testing. Full `npm audit` reports zero vulnerabilities. Deployed security headers were fetched and confirmed for HSTS, CSP, `nosniff`, and frame denial. No critical/high vulnerability was confirmed in this limited audit. Do not interpret that as a guarantee of security.

## Architecture and limitations

- Routes: `/`, `/air-quality`, `/planner`, `/indoor`, `/impact`, `/family`, `/advisor`, `/settings`, `*` in `src/App.tsx`.
- Client state: `src/context/AppContext.tsx`, hooks under `src/hooks/`.
- Provider and domain logic: `src/services/`, `src/utils/`, `src/constants/`.
- Serverless API: `api/chat.ts`, `api/plan.ts`, `api/aqi.ts`, `api/health.ts`; shared handlers in `api/_lib/`.
- UI: `src/components/`, `src/pages/`; styles in `src/index.css`.
- Tests/config: colocated `*.test.*`, `vitest.config.ts`, `tsconfig*.json`, `package.json`.
- Deployment: `vercel.json`, `.vercelignore`.

The overall model-data assessment is labeled estimated CPCB-style and official station data is kept distinct. This audit confirms implementation structure and unit tests, not upstream correctness/freshness at the time of use. No US AQI substitution or derived official AQI was observed in reviewed code.

## Baseline and authorization gate

**Original baseline score:** 86/100. **Current evidence-based score:** 87/100. Branch coverage moved 81.67% (682/835) to 85.06% (712/837), and a live unsafe-output defect has a locally verified guard. The guard is not deployed. This is an internal estimate, not an organizer score, and does not imply 98+ readiness.

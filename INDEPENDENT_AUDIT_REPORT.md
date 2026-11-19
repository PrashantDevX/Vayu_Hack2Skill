# Vayu — Independent Technical Audit

**Project:** Vayu — GenAI urban air-quality and family-protection assistant
**Challenge:** Hack2Skill PromptWars — Challenge 6 (Urban Air Quality Assistant)
**Repository:** https://github.com/PrashantDevX/Vayu_Hack2Skill
**Audited commit:** `6003d389376ba5f041a2a6c09efbc3ca347695a8` (branch `main`, clean tree, `HEAD` == `origin/main`)
**Production URL:** https://vayu-wheat.vercel.app
**Audit date:** 2026-11-19
**Audit mode:** read-only. No application source, configuration, dependency, deployment or Git state was modified.
**Auditor:** independent principal-engineer review (no stake in the previous audit scores)

---

## 1. Executive summary

Vayu is a genuinely engineered application, not a prototype dressed as one. The environmental core is
correct: the CPCB breakpoint tables match the official methodology exactly, the composite index uses the
maximum valid sub-index (never an average), the coverage rule is enforced, out-of-scale values are capped
and flagged, and model estimates are kept visually and semantically separate from official station data.
180 automated tests pass, `npm audit` reports zero vulnerabilities, and the production security headers are
strong.

**However, the product's headline capability — the GenAI assistant — is completely non-functional in
production.** `/api/chat` and `/api/plan` return HTTP 500 `FUNCTION_INVOCATION_FAILED` on every request,
including `GET`. The runtime log proves a cold-start module-resolution crash:

```
ERR_MODULE_NOT_FOUND: Cannot find module '/var/task/src/constants/sources'
  imported from /var/task/src/services/chatFallback.js
```

The cause is a single extensionless import (`../constants/sources`) in code that the Vite front-end build
resolves happily but the Node ESM serverless runtime cannot. `src/services/chatFallback.ts:1` was introduced
in the most recent commit (`6003d38`), and it is the only commit in the entire Git history that makes any
`api/` handler import from `src/`. The previous production deployment (`a27b948`) still answers normally, so
this is a confirmed regression, not a long-standing limitation.

The site does not break for users: the client catches the failure and serves the deterministic fallback,
and it labels that output honestly ("Deterministic guidance"). That is good design. But it means Gemini has
not served a single production request at this commit, and the deterministic fallback that replaces it
misroutes 19% of realistic in-scope questions (6 of 32 synthetic cases), including "What is the air quality
right now?" and "What causes indoor air pollution?".

The second systemic weakness is verification depth: every test runs in Vitest/jsdom or Vitest/node, which
resolves TypeScript modules the way Vite does. Nothing in the suite exercises the module graph the way the
serverless runtime does, so a two-endpoint total outage ships green. No browser automation, axe or
Lighthouse tooling is installed, so the UI, accessibility and runtime performance claims are unverified.

**Independently measured score: 70.5 / 100.** The environmental-data dimension earns near-full marks; the
GenAI dimension is heavily discounted for a confirmed production failure rather than for lack of evidence.

---

## 2. Scorecard

| # | Dimension | Max | Awarded | % | Basis |
|---|---|---:|---:|---:|---|
| 1 | Problem Statement Alignment | 15 | 11.0 | 73% | Every pillar exists; the "GenAI-powered" pillar is dead at runtime |
| 2 | Functional Completeness | 20 | 13.0 | 65% | All routes and deterministic features work; advisor/plan AI path down; no browser verification |
| 3 | GenAI Quality and Personalization | 15 | 6.0 | 40% | Well-designed contracts/safety, but 0 successful live requests; fallback misroutes 19% |
| 4 | Environmental Data Accuracy | 15 | 14.0 | 93% | CPCB tables exact, 126 independent numeric checks pass; Pb absent; averaging mismatch disclosed |
| 5 | Code Quality and Architecture | 10 | 8.0 | 80% | Strict TS, no `any`, clean layering; shared-module packaging boundary is wrong |
| 6 | Security and Privacy | 10 | 9.0 | 90% | Strong headers, strict schemas, no secrets, quantized coords; rate-limit identity unproven in practice |
| 7 | Testing and Reliability | 5 | 3.5 | 70% | 180 tests green, coverage above gate; no test can catch a serverless module-load failure |
| 8 | Performance and Efficiency | 5 | 3.0 | 60% | Good initial bundle; 443 kB route chunk; no Lighthouse measurement |
| 9 | Accessibility and UX | 5 | 3.0 | 60% | Correct primitives in source; no axe/browser evidence |
| | **TOTAL** | **100** | **70.5** | **70.5%** | |

### Why marks were deducted

- **GenAI (−9):** the two AI endpoints return 500 for every request. This is a confirmed defect with a
  reproducible root cause, not an evidence gap.
- **Functional (−7):** AI brief and AI chat never reach Gemini; no browser/E2E coverage of onboarding,
  geolocation denial, charts or mobile layout.
- **Alignment (−4):** the challenge explicitly asks for a *GenAI-powered* assistant; that requirement is
  presently satisfied only by a deterministic rule engine.
- **Testing (−1.5):** the suite has no runtime-fidelity test for the deployed module graph.
- **Performance/A11y (−4):** tooling not executed (BLOCKED), so these remain unproven rather than failed.
- **Environmental (−1):** Pb is part of the CPCB AQI table and is not modelled (7 of 8 pollutants).

No double-penalisation was applied: the production AI failure is counted once, in dimension 3, and its
user-facing consequence (no AI brief) once in dimension 2.

---

## 3. Project architecture (verified)

```
┌──────────────────────────── React 19 + Vite 8 SPA ────────────────────────────┐
│ AppShell (sidebar, skip-link, location + onboarding dialogs)                   │
│ 8 lazy routes: / /air-quality /planner /indoor /impact /family /advisor /settings│
│ AppContext: profile, location, air, planner (memoised), checklist             │
│ hooks: useAirQuality (fetch/refresh/stale), useLocalStorage (Zod-validated)    │
│ services: aqiService (Open-Meteo), officialService (/api/aqi), geocoding,      │
│           recommendationService (deterministic planner), chatService, planService│
│ utils: aqi (CPCB maths), impact (factors/CADR/exposure), date, profile         │
└───────────────────────────────────────────────────────────────────────────────┘
        │ fetch /api/*                                   │ fetch (CORS)
        ▼                                                ▼
┌──────────── 4 Vercel Node functions, region bom1 ────────────┐   ┌──────────────────────┐
│ api/health  GET  config flags, no secrets                    │   │ Open-Meteo air +     │
│ api/aqi     GET  data.gov.in CPCB station data (best effort) │──▶│ weather + geocoding  │
│ api/chat    POST validated Gemini chat + deterministic fallback│  └──────────────────────┘
│ api/plan    POST validated Gemini daily brief (optional)     │   ┌──────────────────────┐
│ api/_lib/*  adapter, gemini, rateLimit, aiOutput, requestBody│──▶│ data.gov.in CPCB     │
└──────────────────────────────────────────────────────────────┘   └──────────────────────┘
                                                                   ┌──────────────────────┐
                                                                   └▶ Gemini (models API) │
```

**State and persistence.** All user state is client-side: `vayu.profile.v1`, `vayu.location.v1`,
`vayu.checklist.v1`, `vayu.onboarded.v1`. Every read is Zod-validated; corrupt values fall back to defaults.
Coordinates are quantized to 2 decimals before storage or cache-keying. There is no database and no
cross-user state.

**Caching.** In-memory per instance: 10 min air quality (keyed on 2-dp coordinates), 60 min geocoding,
10 min official data (3 min on failure). Serverless instances do not share it, which is intentional.

**Deployment.** GitHub `main` auto-deploys; exactly four functions are published (`api/aqi`, `api/chat`,
`api/plan`, `api/health`), all pinned to `bom1` because data.gov.in refuses `iad1`. SPA rewrites and security
headers come from `vercel.json`.

**Verified build state (this audit):**

| Command | Result |
|---|---|
| `npm run typecheck` | EXIT 0 |
| `npm run lint` | EXIT 0, zero warnings |
| `npm test` | EXIT 0 — **24 files / 180 tests pass** |
| `npm run test:coverage` | EXIT 0 — **94.80 / 86.24 / 97.61 / 98.21** (stmts/branch/fns/lines) |
| `npm run build` | EXIT 0 — initial 407.70 kB (127.16 kB gzip) |
| `npm audit` | EXIT 0 — **0 vulnerabilities** (previously reported 7 high dev-only advisories) |

---

## 4. Problem statement alignment

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| A. Location-aware air-quality intelligence | **Implemented, verified** | `src/services/aqiService.ts`, `src/hooks/useAirQuality.ts`; live Open-Meteo probe | Model data only from this path, labelled as such |
| B. Family and lifestyle personalization | **Implemented, verified** | `src/services/recommendationService.ts:110-312`; planner diff test | Children/elderly/outdoor-worker add sections; commute/budget/cooking change text |
| C. GenAI-powered recommendations | **Implemented, FAILED at runtime** | `api/chat.ts`, `api/plan.ts`; runtime log `ERR_MODULE_NOT_FOUND` | Endpoints 500; Gemini unreachable in production |
| D. Personalized low-emission daily routines | **Implemented, verified (deterministic)** | planner + checklist persistence | Timing uses best/worst hourly windows |
| E. Indoor air-quality suggestions | **Implemented, verified** | `src/pages/IndoorAir.tsx`, `estimateCadr` | No predicted indoor concentration claimed |
| F. Sustainable alternatives | **Implemented, verified** | `src/constants/alternatives.ts` | Deliberately qualitative; no invented kg figures |
| G. Transparent impact calculations | **Implemented, verified** | `src/utils/impact.ts`; independent arithmetic | Versioned factors, ±20% band, savings floored at 0 |
| H. Community-oriented solutions | **Implemented, partial** | `alternatives.ts` community list | No community-scale modelling or aggregation |
| I. Vulnerable-group protection | **Implemented, verified** | planner school/elderly/worker sections, `FamilyProtection` | Safety language intact |
| J. Accessibility and usability | **Implemented, unverified** | skip-link, `:focus-visible`, `prefers-reduced-motion`, 43 `aria-label` | No axe/browser run |
| K. Performance during severe pollution | **Implemented, verifiable** | Severe-band branches in planner/fallback | Behaviour differs at AQI > 200/> 300 |

---

## 5. Strongest technical decisions

1. **CPCB fidelity.** Bands are expressed as explicit non-overlapping concentration ranges
   (`src/constants/aqi.ts:35-85`) rather than continuous boundaries, so 31 µg/m³ PM2.5 yields 51, not 50.2.
   All 84 boundary points I tested independently are exact.
2. **Honest provenance.** The official path never invents an AQI. `api/aqi.ts` returns
   `available: true, aqi: null` with station concentrations, CO marked `unit: 'as published'`. Live
   confirmation: Sonia Vihar, Delhi — PM10 160, CO 90, O3 21, NH3 10, `aqi: null`.
3. **Failure honesty.** Missing weather fields stay `null` and render "Unavailable"; nothing is coerced to 0.
4. **Bounded AI output.** Strict Zod request/response schemas, closed source enum, safety regexes,
   relevance checks and clamping of over-long greetings instead of discarding a valid brief.
5. **Client-side degradation with correct labelling.** `chatService.ts:57-63` and `AIAdvisor.tsx:98-103`
   show "Deterministic guidance" versus "AI-assisted", so a fallback is never passed off as Gemini.
6. **Versioned impact methodology** (`vayu-planning-2026.1`) surfaced next to every number, with an explicit
   "personal emissions ≠ city AQI" limitation.

## 6. Weakest technical areas

1. **The serverless module boundary.** Shared `src/` modules are authored for a bundler
   (`moduleResolution: "bundler"`) and then executed by a non-bundling Node ESM runtime. One missing file
   extension takes down two of four functions.
2. **No runtime-fidelity test.** The suite proves logic, not deployability.
3. **Deterministic intent routing.** 15 of 32 probes fall to `unknown`; 6 of those are legitimate questions.
4. **Fallback personalization gaps.** The purifier answer ignores the budget band it was given.
5. **Zero browser evidence.** Not a single interaction has been verified in a real browser in this repository.

---

## 7. Confirmed defects (summary)

Full register with reproduction steps is in §11. The three that matter:

- **VAYU-P0-001** — `/api/chat` and `/api/plan` return 500 on every request. Root cause proven.
- **VAYU-P1-001** — deterministic assistant defers 19% of in-scope questions to a generic deflection.
- **VAYU-P1-002** — no browser/E2E test exists, so user-facing regressions ship undetected.

## 8. Unverified functionality (not failed — unverified)

- Onboarding flow in a real browser (city search, geolocation granted/denied, keyboard traversal).
- Charts rendering, responsive/mobile layout, console errors, dead buttons.
- Colour contrast, focus order, screen-reader announcements.
- Lighthouse performance/SEO/accessibility scores.
- Cross-instance rate limiting (Upstash configured? identity header behaviour under load).

## 9. Critical blockers

| Blocker | Consequence |
|---|---|
| `ERR_MODULE_NOT_FOUND` on `src/constants/sources` | GenAI chat and AI brief are non-functional in production |
| No Playwright/axe/Lighthouse installed | UI, accessibility and performance cannot be evidenced |
| Windows host: `vercel build` fails (`EPERM` symlink; project Node `26.x` rejected by CLI 56) | Local reproduction of the serverless bundle is blocked |
| Audit rules forbid source edits/deploys | The P0 is reported, not fixed, in this audit |

## 10. Submission readiness

**Not submission-ready as it stands.** The application is strong where it is measurable (environmental
methodology, security posture, deterministic planning) and broken where the challenge is most distinctive
(GenAI). A one-line extension fix plus a two-endpoint smoke test would restore the headline feature; the
remaining gaps are verification and polish.

---

## 11. Consolidated defect register

| ID | Severity | Files | Technical explanation | Expected | Actual | Repro | Fix | Verification |
|---|---|---|---|---|---|---|---|---|
| **VAYU-P0-001** | **P0** | `src/services/chatFallback.ts:1` (imported by `api/chat.ts`, `api/plan.ts`) | Extensionless ESM specifier `'../constants/sources'`. Vite resolves it; Node ESM does not. Function crashes during module linking, before any handler code runs, so every method returns 500. | `POST /api/chat` returns 200 with `source: gemini\|fallback` | HTTP 500 `FUNCTION_INVOCATION_FAILED` for GET/POST/OPTIONS | `POST https://vayu-wheat.vercel.app/api/chat` with a valid body | Append `.js`: `from '../constants/sources.js'`. Audit the whole `api/`-reachable graph for extensionless imports. | `vercel logs --status-code 500 --json` shows no `ERR_MODULE_NOT_FOUND`; both endpoints return 200; a deployed smoke test asserts 200 and a valid `source` value |
| **VAYU-P1-001** | P1 | `src/services/chatFallback.ts:18-33` | Keyword classifier misses ordinary phrasings: "What is the air quality right now?" → `unknown`; "What causes indoor air pollution?" → `unknown` (no `pollution` / `air quality` rule); "What does PM2.5 mean?" → `unknown`. 15/32 probes → `unknown`, 6 of them in-scope. | In-scope question receives a topical answer | Generic "I can help with…" deflection | 32-case harness (§AI report) | Add intent rules for ambient AQI queries, pollutant definitions, pregnancy, outdoor work; make `unknown` a last resort with a context-bearing answer | Re-run the 32-case harness; in-scope deflection ≤ 2 |
| **VAYU-P1-002** | P1 | repo-wide (no `e2e/`, no Playwright) | Correctness is proven only in jsdom/node. Nothing imports the API through the production loader, and no browser drives the UI. A two-endpoint outage and any layout regression are invisible to CI. | A smoke test that fails when a deployed function 500s or a route fails to render | Green suite with a dead feature | `npm test` passes at a commit where both AI endpoints 500 | Add a Playwright suite (routes, onboarding, geolocation denial, planner regeneration) and a post-deploy `/api/health`+`/api/chat`+`/api/plan` smoke script | CI fails on the current deployment; passes after VAYU-P0-001 is fixed |
| **VAYU-P2-001** | P2 | `src/services/chatFallback.ts:55` | Purifier answer ignores `profile.budget`, although the planner's equivalent advice (`recommendationService.ts:116-118`) uses it. A ₹1,500-budget user and a premium user receive identical text. | Budget-appropriate guidance | Identical text for all budgets | Cases 3, 4, 5 in the AI report | Branch the fallback on `profile.budget` as the planner already does | Cases 4 and 5 differ |
| **VAYU-P2-002** | P2 | `api/aqi.ts:320` | City is only trimmed and length-capped. `<script>alert(1)</script>` reaches the provider (log: `official provider request failed`), returns 200 "temporarily unavailable" and caches the failure for 3 min. | 400 for malformed city; no upstream call | 200 + wasted provider quota | `GET /api/aqi?city=<script>alert(1)</script>` | Validate with the same `citySchema` used by `/api/chat` | 400 response, no upstream call |
| **VAYU-P2-003** | P2 | `AGENTS.md:66`, `README.md:180`, `docs/DEMO_GUIDE.md:155`, `AUDIT_REPORT.md:48` | Stale numbers: AGENTS says 22 files/135 tests (actual 24/180); README coverage 93.14/81.31/96.59/96.42 (actual 94.80/86.24/97.61/98.21); DEMO_GUIDE says 114 tests; AUDIT_REPORT asserts "No P0 blocker was verified". | Docs match reality | Four documents contradict the build | Read the files | Update counts and replace the P0 statement | A doc test or checklist step |
| **VAYU-P2-004** | P2 | `src/constants/aqi.ts:35-85` | Pb is in the CPCB AQI table (8 pollutants) but only 7 are modelled. | Declared scope for Pb | Silently absent | Compare to `About_AQI.pdf` | Document the omission explicitly, or add Pb as informational | Docs state the deviation |
| **VAYU-P3-001** | P3 | `.vercel/project.json` | Project Node version is `26.x`; CLI 56 rejects it locally, so `vercel build`/`vercel dev` cannot reproduce production on this host. | A supported pinned version (e.g. `24.x`) | Local serverless reproduction blocked | `vercel build` | Pin the Node version in project settings | `vercel build` succeeds |
| **VAYU-P3-002** | P3 | `src/services/chatFallback.ts:26,31` | `open` and `run` are over-broad keywords ("open source", "running late"). | Word-boundary intent matching | Occasional misclassification | Inspect regexes | Tighten with context words | Classifier unit tests |
| **VAYU-P3-003** | P3 | `src/pages/AIAdvisor.tsx:98` | Source badge is suppressed for `index === 0`, so the seeded first assistant message shows no provenance label. | Every assistant message labelled | First message unlabelled | Render advisor | Drop the `index > 0` condition | Component test |

---

## 12. Prioritised improvement plan

**1. Fix the module-resolution P0 (do this first).**
*Why:* the challenge is about a GenAI assistant; right now no model output can reach a user.
*Dimensions:* GenAI (+large), Functional, Alignment.
*Files:* `src/services/chatFallback.ts:1`; then audit every module reachable from `api/*` for extensionless
imports (`src/constants/aqi.ts` and `src/types.ts` imports are type-only and safe).
*Change:* `'../constants/sources'` → `'../constants/sources.js'`.
*Test:* `POST /api/chat` and `POST /api/plan` return 200 with `source: "gemini"`; `vercel logs --status-code 500`
is empty.
*Evidence of completion:* live 200 responses plus a recorded AI evaluation replacing the blocked section.

**2. Add a deployed smoke test to CI.**
*Why:* this class of bug is invisible to unit tests and was invisible to review.
*Dimensions:* Testing, Reliability.
*Files:* new `scripts/smoke-api.mjs` + CI step.
*Change:* after deploy, assert `/api/health` 200, `/api/aqi?city=Delhi` 200, `/api/chat` 200, `/api/plan` 200,
and that each JSON body matches its aqi/chat/plan schema.
*Test:* run against a deliberately broken preview; the job must fail.

**3. Improve deterministic intent coverage.**
*Why:* with no key or provider outage this is the product, and it currently deflects 19% of in-scope questions.
*Dimensions:* GenAI, UX.
*Files:* `src/services/chatFallback.ts:18-33,51-68`.
*Change:* add ambient-AQI, pollutant-definition, pregnancy and outdoor-worker intents; make the `unknown`
answer context-bearing rather than a menu.
*Test:* extend the 32-case harness; require ≥90% in-scope relevance.

**4. Make the fallback honour the profile it is given.**
*Why:* personalization is a scored requirement and the budget band is already available.
*Files:* `src/services/chatFallback.ts:55`.
*Change:* mirror `recommendationService.ts:114-118` budget branching.
*Test:* budget-specific assertions.

**5. Add browser verification (Playwright + axe).**
*Why:* nothing user-facing has ever been executed in a browser here.
*Dimensions:* Accessibility, UX, Performance, Functional.
*Files:* new `e2e/` + `playwright.config.ts`; add `@axe-core/playwright`.
*Change:* cover the ten flows in the brief, including geolocation denial and a forced API failure state.
*Test:* `npx playwright test`; axe must report zero critical/serious violations.

Secondary, in order: validate `/api/aqi` city input (P2-002); correct stale documentation (P2-003); state the
Pb scope (P2-004); pin a supported Node version (P3-001); tighten keyword regexes (P3-002); label the first
assistant message (P3-003).

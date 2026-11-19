# Vayu — Performance and Accessibility Report

**Commit:** `6003d38` · **Deployment:** `dpl_AXgbLBRE68vQWQg6LmYepS2MyQ9r` · **Date:** 2026-11-19
**Mode:** read-only audit · **Reference production:** https://vayu-wheat.vercel.app

---

## 1. Headline: nothing in this dimension was measured at runtime

This report is deliberately blunt about its own limits. The brief asks for measured Core Web Vitals,
Lighthouse scores and an automated accessibility scan. **None of that was possible in this environment**, and
I will not present static reasoning as if it were measurement.

| Tool | Status | Evidence |
|---|---|---|
| Playwright / `@playwright/test` | **NOT INSTALLED** | absent from `node_modules`; no global binary |
| `axe-core` / `@axe-core/playwright` | **NOT INSTALLED** | same |
| Lighthouse | **NOT INSTALLED** | absent locally and globally (`Get-Command lighthouse` → not found) |
| Puppeteer | **NOT INSTALLED** | same |
| Chrome / Chromium driver | **NOT AVAILABLE** | required by all of the above |

Installing a browser stack plus Lighthouse is a multi-hundred-megabyte environment change. The audit rules
forbid modifying the project to make the audit pass, so I did not install them.

**Consequence for scoring:** performance and accessibility are scored on what *can* be evidenced — shipped
bundle weight, load-path structure, and a static inventory of the accessibility implementation. Both receive
partial credit and **neither receives a pass**. A green Lighthouse score cannot be claimed, and neither can a
violation count, in either direction.

---

## 2. Measured: production bundle (`npm run build`, exit 0)

These numbers are real output from Vite 8.3.8, not estimates.

| Asset | Raw | Gzip |
|---|---:|---:|
| `index.html` | 1.14 kB | 0.57 kB |
| `assets/index-*.css` | 64.53 kB | **13.63 kB** |
| `assets/index-*.js` (entry) | 407.70 kB | **127.16 kB** |
| `assets/AirQuality-*.js` | **443.30 kB** | **124.24 kB** |
| `assets/ImpactSimulator-*.js` | 27.01 kB | 7.74 kB |
| `assets/createLucideIcon-*.js` | 12.06 kB | 4.73 kB |
| `assets/AIAdvisor-*.js` | 10.33 kB | 4.24 kB |
| `assets/IndoorAir-*.js` | 8.98 kB | 3.25 kB |
| `assets/DailyPlanner-*.js` | 8.35 kB | 2.87 kB |
| `assets/FamilyProtection-*.js` | 6.14 kB | 2.51 kB |
| `assets/Settings-*.js` | 5.81 kB | 2.01 kB |
| `assets/sources-*.js` | 1.70 kB | 0.81 kB |
| `assets/NotFound-*.js` | 0.53 kB | 0.34 kB |

2658 modules transformed, build time ~1.0 s. Total first-load weight for the dashboard route is roughly
**141 kB gzip** (entry + CSS + HTML), which is reasonable for a React 19 SPA.

### 2.1 The one real performance problem: the `/air-quality` chunk

`AirQuality-*.js` is **443.30 kB raw / 124.24 kB gzip** — larger than the entire application entry point.
It is the only module that imports `recharts` (`src/pages/AirQuality.tsx:5-12`), and recharts pulls in d3
scales and shape libraries. Users who never open the air-quality page never download it (correctly
`lazy()`-loaded, `src/App.tsx:8`), but users who *do* open it pay a second near-entry-sized download.

Practical impact: on a slow 3G connection at ~400 kbps, that chunk alone takes ~2.5 s to transfer, on top of
the 127 kB entry. For a mobile-first Indian audience during a smog episode — the exact target user — this is
the difference between a usable page and a spinner.

Mitigations that would not require architectural change: import only the two chart primitives used, or
replace `ComposedChart` with a hand-rolled SVG (the data is a 24-point series), which would likely cut the
chunk by 80–90%.

### 2.2 Dependency hygiene

`package.json` declares 8 runtime dependencies. One of them, **`framer-motion@^14.14.0`, is never imported
anywhere in `src/`** (verified by grep: zero matches). It is tree-shaken out of the bundle, so it costs users
nothing at runtime, but it inflates install time and attack surface. `lucide-react` is correctly
code-split into its own `createLucideIcon` chunk.

---

## 3. Load path: what is and is not optimised (static review)

| Signal | Status | Evidence |
|---|---|---|
| Route-level code splitting | **PASS** | All 8 non-dashboard routes are `lazy()` (`src/App.tsx:8-15`) |
| Bundle minification | **PASS** | Vite production build, content-hashed filenames |
| `preconnect` to Open-Meteo | **ABSENT** | `index.html` has no `<link rel="preconnect">`; the first AQI request pays full DNS+TLS |
| `preload` of the entry chunk | **ABSENT** | Vite emits a module script; no explicit preload |
| Font loading | **LOW RISK** | No `@font-face` and no Google Fonts request — system font stack only |
| Images | **N/A** | Zero `<img>` elements in the entire codebase; icons are inline SVG components |
| Service worker / offline | **ABSENT** | No PWA; a cold offline visit fails the data fetch but the shell is a static asset |
| Compression | **PASS** | Vercel serves Brotli/gzip (gzip figures above) |
| HTTP caching of HTML | **PASS** | `Cache-Control: public, max-age=0, must-revalidate` |
| Immutable asset caching | **PASS (by convention)** | Content-hashed filenames under `/assets/` |
| Third-party scripts | **NONE** | No analytics, no tag manager, no ad SDK |

The missing `preconnect` is a cheap, safe win: adding
`<link rel="preconnect" href="https://air-quality-api.open-meteo.com" crossorigin>` would remove one
DNS+TLS round trip from the critical path without touching application logic.

---

## 4. Accessibility: static inventory (verified in source)

No browser was run. Everything below is a fact about the shipped markup and stylesheet; whether it *works*
for a screen-reader user is unverified.

### 4.1 Foundations — all present

| Requirement | Status | Evidence |
|---|---|---|
| Document language | **PASS** | `<html lang="en">` (`index.html:2`) |
| Responsive viewport | **PASS** | `width=device-width, initial-scale=1.0` (no `user-scalable=no`) |
| Page title | **PASS** | Descriptive `<title>` + `meta description` |
| Landmarks | **PASS** | one `<main id="main-content">`, one labelled `<nav>`, one `<header>`, three `<aside>` (`AppShell.tsx:51,61,93,94`; `AIAdvisor.tsx:72`; `DailyPlanner.tsx:149`) |
| Skip link | **PASS** | `<a className="skip-link" href="#main-content">` (`AppShell.tsx:50`), styles at `index.css:61` |
| Visible focus indicator | **PASS** | `:focus-visible { outline:2px solid #3f604d; outline-offset:2px }` (`index.css:63`) plus explicit rules for `button/a/input/select/summary` (`index.css:313-317`) |
| Reduced motion | **PASS** | `@media (prefers-reduced-motion: reduce)` neutralises all animation/transition/scroll (`index.css:258`) |
| Screen-reader-only utility | **PASS** | `.sr-only` clip-pattern (`index.css:62`) |
| One `<h1>` per page | **PASS** | verified all 9 pages: exactly 1 each |
| Form labels | **PASS** | 22 `htmlFor` associations; search input uses an `.sr-only` `<label>` (`LocationSearch.tsx:83`) |
| Decorative icons hidden | **PASS** | every lucide icon carries `aria-hidden="true"` (spot-checked across `AppShell`, `LocationSearch`, `Dashboard`) |
| Icon-only buttons named | **PASS** | 43 `aria-label` instances, including "Close dialog", "Open navigation", "Close navigation" |
| Toggle state announced | **PASS (partial)** | checklist tasks use `aria-pressed` (`Dashboard.tsx:35`) |

### 4.2 Dialog implementation — genuinely good

The project does **not** hand-roll a modal. `src/components/Modal.tsx` renders a native `<dialog>` and calls
`dialog.showModal()` (`Modal.tsx:21`), which gives, for free and correctly:

- implicit `role="dialog"` and `aria-modal="true"` semantics (this is why the grep for `role="dialog"`
  returns zero — none is needed);
- focus trapping and background inertness;
- `Escape` to dismiss, via the native `cancel`/`close` events (`Modal.tsx:32-35`);
- a labelled dialog, since the heading id is wired with `aria-labelledby={titleId}` (`Modal.tsx:29`);
- an explicitly labelled close control (`Modal.tsx:45`).

This is the correct pattern and is better than most hand-written modals I review.

### 4.3 Charts — a real text alternative exists

`src/pages/AirQuality.tsx:171` marks the recharts container `aria-hidden="true"`, and immediately below it
(lines 191-208) provides a `<details>` element containing a fully semantic `<table>` with `<caption>`,
`<th scope="col">` and `<th scope="row">` for all 24 hours. That is exactly the right construction: the SVG
is hidden from assistive technology, and the same data is available as structured text.

The official-station table (`DataProvenance.tsx:60`) and the pollutant table (`AirQuality.tsx:108`, with an
`.sr-only` caption) follow the same pattern.

### 4.4 Interactive state and error announcements — partial

| Signal | Count | Assessment |
|---|---:|---|
| `aria-live` | 2 | Loading state is announced (`Dashboard.tsx:82`) — good |
| `role="status"` | 7 | Data-status pill and equivalents — good |
| `role="alert"` | 6 | Errors announced assertively — good |
| `aria-describedby` | **0** | **Gap:** inline form errors are announced as alerts but not associated with the input that caused them |
| `aria-invalid` | **0** | **Gap:** a failing field is never marked invalid |
| `aria-current` | **0** | **Gap:** see below |

---

## 5. Accessibility findings

### A11Y-01 — Active navigation item is not exposed to assistive technology (Medium)

- **Files:** `src/components/AppShell.tsx:63-69`, `77`
- **Evidence:** `NavLink` sets only `className={({isActive}) => (isActive ? 'active' : '')}`. The current page
  is conveyed visually by colour alone. There is no `aria-current="page"` anywhere in `src/` (grep count: 0).
- **Impact:** a screen-reader user navigating the sidebar cannot tell which page they are on. This is a
  WCAG 2.4.8 (Location) / 1.4.1 (Use of Colour) concern.
- **Fix:** `<NavLink aria-current={isActive ? 'page' : undefined}>` via the render-prop `className`/`style`
  pattern already in use, or pass `aria-current` through NavLink's `isActive` callback.

### A11Y-02 — Mobile menu button does not expose expanded state (Medium)

- **File:** `src/components/AppShell.tsx:95-97`
- **Evidence:** `<button className="menu-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>`
  has no `aria-expanded` and no `aria-controls`. The sidebar it toggles has no `id`. Grep for
  `aria-expanded` across `src/` returns **0**.
- **Impact:** the control's state is invisible to assistive technology; users cannot tell whether the menu is
  open, and the relationship between button and panel is unstated.
- **Fix:** `aria-expanded={menuOpen}` plus `aria-controls="primary-sidebar"` and a matching `id` on the
  `<aside>`; change the label to "Toggle navigation".

### A11Y-03 — Form errors are not programmatically tied to their inputs (Medium)

- **Files:** `src/components/OnboardingDialog.tsx:116`, `src/pages/ImpactSimulator.tsx:217`,
  `src/pages/Settings.tsx:114`
- **Evidence:** each renders `<p className="form-message error" role="alert">`. None sets `aria-invalid` on
  the offending control, and none sets `aria-describedby` pointing at the message (grep: 0 occurrences of
  either attribute).
- **Impact:** `role="alert"` announces the text once, but a user who tabs back to the field gets no indication
  that it is the failing one, and revisiting the field does not re-announce the reason. WCAG 3.3.1 / 3.3.3.
- **Fix:** give each message an `id`, set `aria-describedby` on the input and `aria-invalid={Boolean(error)}`.

### A11Y-04 — Dashboard priority message does not escalate past one threshold (Low / UX)

- **File:** `src/pages/Dashboard.tsx:95-99`
- **Evidence:** the ternary is `aqi > 200 ? 'Keep essential outdoor time short' : 'Keep the day flexible…'`.
  AQI 201 (Poor), 350 (Very Poor) and 480 (Severe) all render the identical sentence.
- **Impact:** not an accessibility defect, but the single most prominent message on the page — the "primary
  message" — carries no severity differentiation at the exact moment severity matters most. It also means the
  severe-smog scenario, which is the product's reason to exist, looks the same as a moderately bad day.
- **Fix:** three bands aligned to the CPCB categories already in `constants/aqi.ts` (>200 Poor, >300 Very
  Poor, >400 Severe).

### A11Y-05 — No `<footer>` landmark (Informational)

- **Evidence:** grep for `<footer>` in `src/` returns 0. Provenance and disclaimer text sit in `<p>` elements
  at the end of each page.
- **Impact:** minor; nothing is unreachable. A `<footer>` would give assistive-technology users a landmark to
  jump to for the methodology/attribution text.

### A11Y-06 — Colour contrast and focus order unverified (Blocked, not a finding)

- **Reason:** requires a rendering engine. The palette is forest green (`#3f604d`, `#315b47`) and cream on
  white/off-white. The focus ring `#3f604d` on cream is very likely compliant, but "very likely" is not
  evidence. Small 9px metadata text (e.g. `#7d867f` on `#f1f3ef` in `index.css`) is the most probable
  contrast failure and must be measured with axe before submission.

---

## 6. What must be measured before this dimension can be scored honestly

Run against the deployed URL (or a preview), not a local dev server:

```bash
# 1. Accessibility — automated
npx playwright install chromium
npm i -D @playwright/test @axe-core/playwright
npx axe https://vayu-wheat.vercel.app --exit   # or an axe-core/playwright spec per route
# target: 0 critical, 0 serious

# 2. Performance — field-representative lab run
npx lighthouse https://vayu-wheat.vercel.app \
  --only-categories=performance,accessibility,best-practices,seo \
  --preset=desktop --output=json --output-path=./lh-desktop.json
npx lighthouse https://vayu-wheat.vercel.app \
  --form-factor=mobile --throttling-method=simulate \
  --output=json --output-path=./lh-mobile.json
```

Minimum bar to claim readiness: accessibility ≥ 95, performance ≥ 85 mobile, LCP < 2.5 s, CLS < 0.1, TBT
< 200 ms on the mobile profile, and zero serious/critical axe violations on all eight routes plus the
onboarding dialog and one open modal.

Also still unverified and worth a manual pass: keyboard-only traversal end to end (including `Escape` on the
location dialog and focus restoration to the trigger), 200% zoom at 1280×720, and a screen-reader pass on the
onboarding flow.

---

## 7. Score contribution

| Dimension | Max | Awarded | Rationale |
|---|---:|---:|---|
| Performance and Efficiency | 5 | **3.0** | Entry payload is good (127 kB gzip) and route splitting is correct; the `/air-quality` chunk is 124 kB gzip for one chart page, no `preconnect`, and zero runtime measurement. A 443 kB chunk for a 24-point line chart is a genuine, fixable cost. |
| Accessibility and UX | 5 | **3.0** | The primitives are unusually good — native dialog, skip link, focus-visible, reduced-motion, `aria-hidden` charts with real table alternatives, one `h1` per page. But four concrete state-association gaps (A11Y-01…03, 05) exist, contrast is unmeasured, and nothing has been executed in a browser. |

Both sit at 60%: real engineering is visible in the source, and no user-facing verification exists to confirm
it works.

---

## 8. Summary

| Area | Result |
|---|---|
| Production build | **PASS** — exit 0, 2658 modules |
| Route code splitting | **PASS** — 8 lazy routes |
| Entry payload | **PASS** — 127.16 kB gzip |
| `/air-quality` chunk weight | **CONCERN** — 443.30 kB / 124.24 kB gzip |
| Resource hints | **GAP** — no `preconnect` to the API origin |
| Dependency hygiene | **GAP** — `framer-motion` declared, never imported |
| Document/lang/viewport/title | **PASS** |
| Landmarks & skip link | **PASS** |
| Focus visible & reduced motion | **PASS** (in CSS) |
| Native dialog semantics | **PASS** |
| Chart text alternative | **PASS** — `aria-hidden` SVG + `<details>` table |
| Nav current-page state | **FAIL** (A11Y-01) |
| Mobile menu expanded state | **FAIL** (A11Y-02) |
| Form error association | **FAIL** (A11Y-03) |
| Colour contrast | **BLOCKED** |
| Lighthouse / axe / Core Web Vitals | **BLOCKED** — tooling not installed |
| Keyboard & screen-reader walkthrough | **NOT RUN** |

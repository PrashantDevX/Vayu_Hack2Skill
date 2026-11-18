# Security and privacy

Vayu handles household composition, health-sensitivity flags and approximate location. None of it is
identifying, none of it leaves the browser except as categories, and there is no account system to breach.

---

## 1. Data inventory

| Data | Where it lives | Lifetime | Leaves the device? |
| --- | --- | --- | --- |
| Household counts (adults, children, elderly) | `localStorage` | until deleted | As counts, to `/api/chat` and `/api/plan` |
| Sensitivity / outdoor-worker flags | `localStorage` | until deleted | As one boolean, to the AI endpoints |
| Commute mode, distance, timing, exercise | `localStorage` | until deleted | Mode and budget band only |
| Cooking fuel, ventilation, purifier, room area | `localStorage` | until deleted | Room area and purifier flag only |
| Location (city name, 2-dp coordinates) | `localStorage` | until deleted | City name to `/api/aqi`; coordinates to Open-Meteo |
| Checklist state | `localStorage` | until deleted | No |
| Air-quality snapshots | Memory only | until reload | No |
| API keys | Server env vars | deployment lifetime | Never |

Explicitly **not collected**: name, email, phone, address, date of birth, diagnosis, medication, medical
records, exact GPS coordinates, IP-based profiles, cookies, analytics identifiers.

---

## 2. Privacy design decisions

- **Coordinate quantisation.** `quantizeCoordinate` rounds to two decimals (~1.1 km) before storage and
  before cache keying. The raw `position.coords` object is never written anywhere.
- **Permission-first geolocation.** `navigator.geolocation.getCurrentPosition` is called only on an explicit
  button press. `Permissions-Policy: geolocation=(self)` allows it for this origin only. Denial is handled
  with a message and city search remains available.
- **Local-only preferences.** No server writes, no database, no sync. Clearing site data removes everything.
- **Minimal AI payload.** The AI endpoints receive categories and booleans, never free-text personal data. The
  client builds the payload explicitly (`chatService.ts`, `planService.ts`) rather than forwarding app state.
- **Deletion is real.** Settings offers "Reset profile only" and "Delete all local data", which removes every
  `vayu.*` key and resets in-memory state. There is no soft-delete or shadow copy.
- **No third-party scripts.** No analytics, no tag manager, no embedded widgets, no external fonts. The CSP
  forbids script sources other than `'self'`.

---

## 3. Secret handling

| Control | Implementation |
| --- | --- |
| Server-side only | Keys read inside `api/*` handlers from `process.env` |
| Never bundled | No key reference in `src/`; grep for `GEMINI_API_KEY` finds only `api/` and docs |
| Never returned | `/api/health` returns booleans; errors return generic messages |
| Never logged | Handlers do not log request bodies or provider errors |
| Not in prompts | The prompt contains context only; the SDK holds the key |
| `.env` ignored | `.gitignore` excludes `*.local`; `.env.example` contains empty values only |

Client-visible configuration is limited to public Open-Meteo endpoints.

---

## 4. Input validation

| Surface | Validation |
| --- | --- |
| Chat request | Zod: message 1–800, AQI 0–500, PM2.5 0–2000, enums/length caps on preference and window strings |
| Plan request | Zod: profile ranges (counts 0–20, room 0–5000), window shape, ≤10 deterministic actions |
| Official query | `city` required, trimmed, ≤80 chars |
| Body size | `content-length` checked before parsing (12 kB / 16 kB) |
| Method | Explicit 405 with `Allow` header |
| JSON parse | Wrapped; malformed body → 400 |
| Provider responses | Zod (or key-normalising parser) before use; unexpected shapes rejected |
| URL parameters | `encodeURIComponent` on city; resource id encoded |
| Client storage | Every read schema-validated; corrupt values fall back to defaults |
| Coordinates | Range-checked (-90..90, -180..180) before acceptance |
| Numeric inputs | Bounded by `min`/`max` and re-validated by `profileSchema` |

The official adapter also bounds the AQI (0–500) and station distance (0–500 km) before display, and never
converts pollutant-only records into an official AQI.

---

## 5. Output safety

- All model output is rendered as text in React, which escapes by default. `dangerouslySetInnerHTML` is not
  used anywhere.
- AI responses are schema-validated and length-capped; plan section titles are an enum.
- Official station and provider strings are length-capped (`asText` → 200 chars) before display.
- No user input is interpolated into a URL without encoding.
- No `eval`, no `new Function`, no dynamic script injection.

---

## 6. Abuse and cost controls

| Control | Value |
| --- | --- |
| Rate limits | chat 20/min, plan 10/min, official AQI 60/min, per client IP |
| Bucket eviction | expired buckets purged above 2,000 entries |
| Request body caps | 12 kB / 16 kB |
| Provider timeouts | 6–18 s, with AbortController |
| Retries | 5xx only, max 1, exponential backoff (client services) |
| Provider cache | 10 min air, 60 min geocoding, 10/3 min official |
| AI output cap | 700–900 tokens |

`x-forwarded-for` is trusted because the app is deployed behind Vercel's proxy. If you deploy elsewhere,
re-derive the client key from a trusted header.

---

## 7. Transport and browser hardening

`vercel.json` sets, for every response:

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' + three Open-Meteo hosts; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(self), camera=(), microphone=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |

`style-src` allows inline styles because the AQI gauge and comparison bars use inline `style` attributes.
That is a deliberate, narrow exception: no inline `<style>` or `<script>` is generated.

---

## 8. Audit findings (2026-11-18)

`npm audit` reports **7 high-severity advisories**, all one root cause:

```
picomatch <= 4.0.7 — ReDoS via single-branch repeated extglobs
GHSA-fc5q-39xc-vjpf / CVE-2026-112366 — CVSS 8.7 (availability only)
Patched versions: none
Reached via: vite → tinyglobby/fdir → picomatch, vitest → same
```

Assessment:

- **Dev-only.** `picomatch` is a build/test-time glob matcher. It is not imported by `src/` or `api/`, and it
  is not present in the browser bundle or the serverless function bundle.
- **Not attacker-reachable at runtime.** The vulnerable pattern requires an application to compile
  attacker-supplied glob patterns. Vayu supplies only static globs to Vite/Vitest.
- **No fix exists yet.** `npm audit fix` proposes downgrading Vite/Vitest to older majors, which would
  reintroduce other issues; `npm audit fix --force` would break the toolchain. The correct action is to wait
  for a patched `picomatch` and upgrade.

Re-check with `npm audit` before submission and after any dependency bump. No other advisories are reported;
the runtime dependency set (React, React Router, Recharts, Zod, `@google/genai`) is clean.

---

## 9. Residual risks

| Risk | Severity | Mitigation / status |
| --- | --- | --- |
| Dev-tool ReDoS (picomatch) | Low (dev-only) | Documented above; upgrade when patched |
| Rate limit bypass via multiple instances | Low | Per-instance counters; move to shared KV for scale |
| IP spoofing of `x-forwarded-for` | Low | Trusted only behind the Vercel proxy |
| Prompt injection influencing wording | Low | Bounded prompt, JSON schema, enum titles, no tool access |
| Provider returns a wrong-but-plausible official AQI | Medium | Provenance label plus original provider/timestamp shown; no silent correction |
| Local storage readable on a shared device | Low | Documented; one-click delete; no identifiers stored |
| Model estimate mistaken for official reading | Low | Separate cards, explicit wording, repeated disclaimer, covered by tests |

---

## 10. Security checklist for contributions

- [ ] No new secret in `src/` or in any response body
- [ ] New request fields validated with Zod and length/range bounded
- [ ] New provider responses validated before use
- [ ] New external domain added to CSP `connect-src`
- [ ] No `dangerouslySetInnerHTML`, `eval` or unencoded URL interpolation
- [ ] Personal data not added to storage or AI payloads without a documented need
- [ ] Failure paths return a labelled unavailable state, not a guessed value

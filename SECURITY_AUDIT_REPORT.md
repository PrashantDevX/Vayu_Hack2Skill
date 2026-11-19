# Vayu — Security and Privacy Audit

**Commit:** `6003d38` · **Deployment:** `dpl_AXgbLBRE68vQWQg6LmYepS2MyQ9r` · **Date:** 2026-11-19
**Mode:** read-only. No secret value was read, printed, or stored during this audit.

---

## 1. Summary

The security posture is good. There are **no critical or high-severity security findings**: no credential
exposure, no injection sink, no unsafe rendering, no plaintext secret in Git history, and no personal data
beyond non-identifying preference categories. The application applies a strict CSP, HSTS, `X-Frame-Options:
DENY`, `nosniff`, a restrictive `Permissions-Policy`, and Zod-strict request validation with body-size caps.

Two **medium** findings need attention before submission, both about abuse resistance rather than
confidentiality:

1. **Rate limiting is process-local only.** No `UPSTASH_*` variables exist in production, so the documented
   per-client limits are enforced per lambda instance, not globally.
2. **`/api/aqi` accepts arbitrary city strings** and forwards them upstream, allowing quota-burning requests
   that are then cached as failures for three minutes.

One **high-availability** issue (not a confidentiality issue) is the AI endpoint outage, recorded here for
completeness because it is the most severe confirmed defect in the system.

---

## 2. Findings by severity

### HIGH

#### SEC-H-01 — Unhandled module-resolution crash disables two API endpoints
- **Files:** `src/services/chatFallback.ts:1` → `api/chat.ts`, `api/plan.ts`
- **Evidence (runtime log, redacted of nothing sensitive):**
  ```
  Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/src/constants/sources'
    imported from /var/task/src/services/chatFallback.js
  Node.js process exited with exit status: 1.
  ```
- **Impact:** availability of the GenAI features. The failure is fail-closed and leaks no internals to the
  client — Vercel returns a generic `FUNCTION_INVOCATION_FAILED` page, and the stack stays in server logs.
- **Not a confidentiality issue:** no data, key or user input is exposed by the crash.
- **Remediation:** append `.js` to the specifier; add a post-deploy smoke test (see main report §12).

### MEDIUM

#### SEC-M-01 — Rate limiting is not enforced across instances
- **Files:** `api/_lib/rateLimit.ts:35-75`
- **Evidence:** `vercel env ls production` lists exactly four variables —
  `GEMINI_API_KEY`, `GEMINI_MODEL`, `DATA_GOV_IN_API_KEY`, `DATA_GOV_IN_RESOURCE_ID`. There is **no**
  `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, so `checkSharedRateLimit()` returns `null` on every
  call and `checkLocalRateLimit()` (an in-process `Map`) is the only limiter.
- **Impact:** an attacker who reaches N warm lambda instances gets roughly N × 20 chat requests per minute.
  Serverless instances are created on demand, so the effective limit is far above the documented 20/min.
  This is an **abuse/cost** boundary (Gemini quota, data.gov.in quota), not an authentication boundary.
- **Mitigating factor:** the identity source is correct. `clientKey()` reads only
  `x-vercel-forwarded-for`, which the platform writes and a client cannot forge, and the Redis key is a
  SHA-256 hash so raw client identifiers are never stored.
- **Honest characterisation:** `docs/SECURITY.md` should state plainly that the limiter is per-instance unless
  Upstash is configured. The code supports the shared limiter; the deployment does not enable it.
- **Remediation:** provision Upstash (the code path is already implemented and tested, including fail-open to
  local), or document the limitation precisely.

#### SEC-M-02 — Unvalidated city parameter reaches the upstream provider
- **File:** `api/aqi.ts:320`
- **Evidence:** `GET /api/aqi?city=<script>alert(1)</script>` returned `200` with
  `"The official provider is temporarily unavailable."`, and the runtime log recorded
  `official provider request failed`. The value is only trimmed and sliced to 80 characters.
- **Impact:** arbitrary strings cause upstream requests (quota consumption) and cache a negative result for
  3 minutes (`UNAVAILABLE_TTL_MS`). Not SSRF: the host is fixed and the value is passed as a query parameter.
- **Remediation:** validate with the same `citySchema` already used by `/api/chat` and `/api/plan`,
  returning 400 without contacting the provider.

### LOW

#### SEC-L-01 — `style-src 'unsafe-inline'` in CSP
- **File:** `vercel.json`
- **Evidence:** `style-src 'self' 'unsafe-inline'`.
- **Impact:** weakens CSS-injection defence-in-depth. No script execution path is opened because
  `script-src` remains `'self'`, and there is **no** `dangerouslySetInnerHTML`, `innerHTML`, `eval`,
  `new Function`, `document.write` or inline `<iframe>` anywhere in `src/` (verified by grep).
- **Remediation:** optional; move to a nonce/hash-based style policy if the styling pipeline allows.

#### SEC-L-02 — Missing secondary isolation headers
- **Evidence:** `cross-origin-resource-policy`, `cross-origin-embedder-policy`,
  `x-permitted-cross-domain-policies`, `x-dns-prefetch-control` are absent.
  (`cross-origin-opener-policy` **is** present.)
- **Impact:** none demonstrated; these are hardening headers. CORP would matter if resources were shared
  cross-origin, which they are not.
- **Remediation:** add `Cross-Origin-Resource-Policy: same-origin` for completeness.

#### SEC-L-03 — Shared "unknown" rate-limit bucket
- **File:** `api/_lib/rateLimit.ts:69-75`
- **Evidence:** requests without `x-vercel-forwarded-for` all hash to `clientKey() === 'unknown'`.
- **Impact:** only affects non-Vercel invocations (local/CLI); in production Vercel always sets the header.
  Correctly covered by a unit test asserting `x-forwarded-for` and `x-real-ip` are **ignored**.

### INFORMATIONAL

| ID | Observation |
|---|---|
| SEC-I-01 | **No secrets in Git history.** `git log -p --all` scanned for `AQ.*`, `AIza…`, `sk-…`, `ghp_…`, `xoxb-`, and `api-key=<key>`; zero matches. Only `.env.example` is tracked. |
| SEC-I-02 | **Keys never reach the browser.** `GEMINI_API_KEY` and `DATA_GOV_IN_API_KEY` are read via `process.env` only inside `api/`; `/api/health` returns booleans (`geminiConfigured`, `officialProviderConfigured`), never values. |
| SEC-I-03 | **No PII collected.** The `Profile` type contains no name, birth date, diagnosis or address. Health-adjacent fields are booleans (`respiratorySensitivity`, `cardiovascularSensitivity`) and counts. |
| SEC-I-04 | **Location minimisation.** Coordinates are quantised to 2 decimals before storage and cache-keying; raw `position.coords` is never persisted. |
| SEC-I-05 | **Error hygiene.** Handlers return generic JSON (`Invalid request`, `Method not allowed`), never stack traces; provider errors are logged server-side only. |
| SEC-I-06 | **Request hardening.** `.strict()` Zod schemas reject unknown properties at every level; control characters are rejected in `message`; bodies are capped at 12 kB / 16 kB by `readJsonBody` with a declared-length fast path and a streaming hard stop. |
| SEC-I-07 | **XSS surface is minimal.** No HTML sinks; React escapes all interpolated text; the only third-party origins in `connect-src` are the three Open-Meteo hosts the app legitimately needs. |
| SEC-I-08 | **No CSRF exposure.** The API is stateless, uses no cookies and no ambient credentials, so cross-site requests carry no authority. CORS is not enabled, and the SPA is served from the same origin. |
| SEC-I-09 | **Dependencies clean.** `npm audit` → 0 vulnerabilities (the previously documented 7 dev-only advisories no longer reproduce at this lockfile). |
| SEC-I-10 | **`api/**/*.test.ts` excluded from deployment.** `.vercelignore` removes 20 ignored files; `vercel inspect` lists exactly four functions, so no test file is publicly reachable. |

---

## 3. Verified production headers

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data:; font-src 'self'; connect-src 'self' https://air-quality-api.open-meteo.com
  https://api.open-meteo.com https://geocoding-api.open-meteo.com; object-src 'none';
  base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(self), camera=(), microphone=()
Cross-Origin-Opener-Policy: <present>
```

Assessment: strong. `frame-ancestors 'none'` plus `X-Frame-Options: DENY` covers clickjacking; `object-src
'none'` and `base-uri 'self'` close two classic bypasses; `upgrade-insecure-requests` prevents mixed content;
`connect-src` is an explicit allow-list rather than `*`.

---

## 4. Validation results (executed in-process against the real handlers)

| Attack input | Status | Verdict |
|---|---:|---|
| `message` > 800 chars | 400 | Rejected |
| Body 13 kB | 413 | Rejected before parsing |
| Unknown root property | 400 | Rejected (`.strict()`) |
| Unknown nested property | 400 | Rejected |
| `city` with `\n` + instructions | 400 | Rejected |
| `city` with `<script>` | 400 on `/api/chat` | Rejected |
| `aqi: 9999` | 400 | Bounded |
| Invalid JSON | 400 | Rejected |
| Empty body | 400 | Rejected |
| Non-POST method | 405 | Rejected |
| 21st request / minute | 429 | Limited (in-instance) |

---

## 5. Privacy assessment against the brief

| Requirement | Status | Evidence |
|---|---|---|
| No names / birth dates / diagnoses stored | PASS | `src/types.ts` `Profile` has no such fields |
| No exact GPS retained | PASS | `quantizeCoordinate` to 2 dp before storage/cache |
| Only non-identifying preferences sent to AI | PASS | `chatService.ts:26-50` payload inspection |
| No household identifier in responses | PASS | Response schemas are closed enums + bounded strings |
| Secrets server-side only | PASS | `process.env` used only under `api/` |
| No sensitive logging | PASS | Logs contain method/path/status and provider failure classes only |

---

## 6. Security score contribution

**9 / 10.** Deducted: 1 point for the confirmed medium abuse-control gaps (SEC-M-01, SEC-M-02). No critical or
high *security* defect exists. SEC-H-01 is an availability defect and is scored under GenAI/Functional, not
double-counted here.

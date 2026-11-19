# Third remediation sprint checklist

Baseline: `main` at `a27b948` matches fetched `origin/main`; working tree was clean. Fresh baseline: 22 files / 144 tests pass; statements 95.02%, branches 85.06%, functions 97.27%, lines 97.88%.

## Pre-edit issue confirmation

- [ ] CPCB concentration ranges in `src/constants/aqi.ts` use continuous anchors (e.g. 0,30,60) that give PM2.5 31 -> 52. Official CPCB source explicitly gives 31 -> 51. Source: https://airquality.cpcb.gov.in/ccr_docs/About_AQI.pdf
- [ ] AI planner returns free-form guidance without post-generation safety validation.
- [ ] Chat endpoint uses generic fallback and its response lacks source discriminator; client treats each valid HTTP 200 body as Gemini. The existing client fallback is intent-aware but not shared with server.
- [ ] Prompt fields include unrestricted strings and browser-submitted deterministic action text. Delimiter strings alone do not isolate untrusted content.
- [ ] API body size uses declared Content-Length only; streamed/absent length bodies have no measured byte cap.
- [ ] Rate limiter is process-local and uses forwarded client headers; no shared Redis configuration is present in `.env.example` or deployment config.
- [ ] Gemini is allowed to return source strings; no server-owned source ID registry is present.

## Planned implementation and verification

- [ ] Replace AQI breakpoint arrays with explicit pollutant bands and interpolation tests; correct methodology docs.
- [ ] Add a shared server-side AI safety evaluator to both endpoints, with varied unsafe phrasing regression cases.
- [ ] Move deterministic chat fallback into a server/client compatible module; add typed `source` and controlled provenance IDs; preserve in UI.
- [ ] Tighten schemas, neutralize control characters and prompt injection structure, remove browser-authored action text from model prompt (regenerate from server-controlled deterministic logic if feasible).
- [ ] Add bounded stream body parser and test 400/413 behavior.
- [ ] Evaluate optional Upstash REST fixed-window counter with per-endpoint keys; use verified platform client identity only. Document in-memory fallback as non-distributed if shared storage is absent or unavailable.
- [ ] Add live evaluation rubric scores for safety, intent, grounding, personalization, actionability and provenance; do not equate HTTP/schema success with case pass.
- [ ] Update requested docs and audit/test reports with measured results.
- [ ] Run typecheck, lint, tests, coverage, build, full npm audit, and configured provider checks. No deploy/push.

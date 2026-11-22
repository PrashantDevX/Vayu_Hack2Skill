# Third remediation sprint — archived completion record

This is a historical record, not an active sprint checklist. Its baseline figures describe the start of that sprint and are superseded by the current results in [`TESTING.md`](TESTING.md) and [`../AGENTS.md`](../AGENTS.md). The latest pass remains local and has not been deployed or externally evaluated.

Baseline: `main` at `a27b948` matched fetched `origin/main`; the working tree was clean. Fresh baseline: 22 files / 144 tests pass; statements 95.02%, branches 85.06%, functions 97.27%, lines 97.88%.

## Pre-edit issue confirmation

- [x] CPCB concentration ranges were checked against the official source and replaced with explicit bands; boundary tests cover PM2.5 31 -> 51. Source: https://airquality.cpcb.gov.in/ccr_docs/About_AQI.pdf
- [x] AI planner and chat outputs receive deterministic safety/relevance validation after generation.
- [x] Chat fallback has an explicit source discriminator and uses the shared intent-based fallback.
- [x] Prompt input is bounded and treated as untrusted; browser-supplied deterministic action text is not part of the plan contract.
- [x] API JSON bodies are bounded while streaming; the Vercel adapter now also caps buffered Node request bodies.
- [x] Optional Upstash rate limiting exists; in-memory per-instance limits remain the documented fallback.
- [x] AI sources are selected from a server-owned registry.

## Planned implementation and verification

- [x] Replace AQI breakpoint tables with explicit pollutant bands, interpolation tests and methodology documentation.
- [x] Add a shared deterministic AI-output safety evaluator to both endpoints, with unsafe phrasing regressions.
- [x] Share the deterministic chat fallback across client/server, with typed source IDs and controlled provenance.
- [x] Tighten request schemas and prompt boundaries; remove browser-authored action text from the plan contract.
- [x] Add bounded streamed-body parsing and 400/413 tests.
- [x] Add optional Upstash fixed-window rate limits and document the per-instance fallback.
- [ ] Live Gemini semantic rubric scoring remains deferred. Existing capture labels only indicate HTTP/schema success; they are not answer-quality passes. Do not treat the historical live capture as safety evidence.
- [x] Update project docs with current measured test, coverage and build results.
- [x] Run typecheck, lint, tests, coverage and build. Dependency audits were previously clean; configured live provider checks and deployment smoke remain environment-dependent and are not claimed here. No push or deploy.

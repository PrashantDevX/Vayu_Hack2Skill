# AI design

Gemini provides optional explanations and daily brief wording. Deterministic TypeScript remains authoritative for AQI, exposure, impact calculations, forecast windows, recommendations and safety fallbacks.

## Chat contract

`POST /api/chat` accepts a strict JSON object with a bounded question, city, estimated model AQI/PM2.5, optional enumerated commute/budget and category forecast windows. It rejects control characters, unknown fields, invalid numeric bounds and malformed bodies. The request body is limited to 12 kB by both declared length and measured stream bytes.

The handler sends system instructions separately from JSON-serialized context. User text is data, not prompt structure, and no XML delimiter is treated as a security boundary. Gemini may return only a short answer. Zod validates shape; deterministic relevance and safety checks reject unrelated or unsafe text. The response includes `source: "gemini" | "fallback"`, answer, and server-selected source IDs. Gemini cannot supply citations.

On absent credentials, provider failure, empty or malformed output, unsafe text or intent mismatch, the endpoint uses the shared intent-based deterministic fallback. It handles exercise, purifier/CADR, ventilation, children/school, elderly members, commute, masks, severe pollution, exposure, indoor sources, impact claims, definitions, ambient conditions, pregnancy, outdoor workers, medical questions, ozone/ioniser devices and unrelated questions. The browser validates the response again and preserves its actual source label.

Two rules are enforced in the deterministic path as well as on model output. Requests for an ozone generator or ioniser get an explicit refusal rather than a topic menu, because that is a safety question, not small talk. Requests for a numeric emissions saving are answered by naming the Impact simulator, which applies the published per-km factors with a ±20% band — the assistant itself never does the arithmetic.

## Daily plan contract

`POST /api/plan` accepts strict location, forecast-window and household preference schemas. Browser-provided deterministic action text is not accepted or sent to Gemini, and the request schema is `.strict()` — an unexpected field is a `400`. The model returns only a greeting and sections whose titles belong to a closed enum.

The prompt lists all eight allowed titles verbatim **and** constrains them with a structured `responseSchema` enum. Both are required: the earlier prompt said "one allowed title" without ever naming one, so the live model invented plausible headings such as "Current Conditions" and every brief was discarded by the enum. The enum itself is unchanged — a title outside it still rejects the brief.

Each guidance section is checked for unsafe or unsupported medical, ozone, improvised electrical filtration, pollutant-reduction percentage, city-AQI and ventilation advice, and for relevance to its section title. Safety patterns ignore matches inside a negated clause, so "avoid any improvised filtration device" is accepted while "attach a filter to a fan" is rejected. Rejections are logged server-side with the section title and rule code (never the household profile). Any failure returns an explicit unavailable brief; the deterministic plan stays visible.

Greeting text may be up to 600 characters from the model and is safely clamped to 160 at a word boundary. Body reads are capped at 16 kB. Sources are derived by the server from the actual environmental context and mapped to trusted metadata in `src/constants/sources.ts`.

## Safety and provenance

The output guard is shared by both endpoints. It is defense in depth alongside constrained prompts, strict schemas, and deterministic fallback behavior; its tests cover varied phrasings of ozone devices, unsafe DIY filter/fan assemblies, medical treatment, unsupported percentages, city-wide AQI claims and blind ventilation. This is not a proof against every possible harmful completion, and live post-change model quality remains unverified because the application was not deployed for this sprint.

Source IDs are server-controlled: `OPEN_METEO_MODEL`, `CPCB_AQI_METHODOLOGY`, `DATA_GOV_IN_STATION_DATA`, `WHO_AIR_QUALITY_GUIDELINES`, and `VAYU_TRANSPORT_FACTOR_METHODOLOGY`. Model fields remain labeled as model estimates; official station observations remain separate. Citations point to source metadata, never model-generated strings.

## Privacy and failure handling

The request carries only the selected city, bounded model/forecast values, non-identifying household counts and preference categories. It never includes names, exact birth dates, diagnoses, medical records, exact GPS coordinates or secrets. API keys remain in server environment variables. Gemini calls have a shared deadline and one retry for transient upstream overload; deterministic behavior remains available when credentials, network or quota are unavailable.

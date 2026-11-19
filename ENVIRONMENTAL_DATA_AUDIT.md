# Vayu — Environmental Data and CPCB Methodology Audit

**Commit:** `6003d38` · **Date:** 2026-11-19
**Reference:** CPCB National Air Quality Index technical document (`About_AQI.pdf`)
**Method:** the implementation was compared against the published tables, then exercised with hand-computed
expectations in an isolated harness (126 assertions, all passing).

---

## 1. Verdict

The CPCB implementation is **correct**. Every published concentration band, sub-index boundary, averaging
period, unit and category label matches the official table. The composite rule uses the maximum valid
sub-index (not an average), enforces the "at least three pollutants including PM2.5 or PM10" sufficiency rule,
caps out-of-scale values at 500 and flags them, and refuses to produce an index from insufficient coverage.

Three methodology notes, none of which is a calculation error:

1. **Pb is not modelled** (7 of the 8 CPCB pollutants). It is a 24-hour filter-based measurement that CAAQMS
   networks do not report continuously, but the omission should be stated rather than implicit.
2. **Instantaneous model values are compared against 24 h / 8 h averaging periods.** The UI states this
   explicitly and labels the result "estimated CPCB-style model AQI"; the averaging column is shown next to
   each pollutant.
3. **Fractional values inside the one-unit gaps between whole-number bands** (e.g. PM2.5 = 30.5) are
   interpolated across the gap rather than clamped. This is documented in the code and produces a monotonic
   result; the CPCB table simply does not define fractional inputs.

---

## 2. Official CPCB table vs implementation

Published 24 h / 8 h breakpoints and sub-index bands (row = AQI category):

| Category | AQI | PM2.5 (24 h) | PM10 (24 h) | NO₂ (24 h) | SO₂ (24 h) | CO (8 h, mg/m³) | O₃ (8 h) | NH₃ (24 h) |
|---|---:|---|---|---|---|---|---|---|
| Good | 0–50 | 0–30 | 0–50 | 0–40 | 0–40 | 0–1.0 | 0–50 | 0–200 |
| Satisfactory | 51–100 | 31–60 | 51–100 | 41–80 | 41–80 | 1.1–2.0 | 51–100 | 201–400 |
| Moderate | 101–200 | 61–90 | 101–250 | 81–180 | 81–380 | 2.1–10 | 101–168 | 401–800 |
| Poor | 201–300 | 91–120 | 251–350 | 181–280 | 381–800 | 10.1–17 | 169–208 | 801–1200 |
| Very Poor | 301–400 | 121–250 | 351–430 | 281–400 | 801–1600 | 17.1–34 | 209–748 | 1201–1800 |
| Severe | 401–500 | 251–500 | 431–600 | 401–600 | 1601–2000 | 34.1–50 | 749–1000 | 1801–2400 |

Implementation, `src/constants/aqi.ts:35-85` — identical for all seven modelled pollutants:

```ts
pm25: band(0,30,0,50)   band(31,60,51,100)  band(61,90,101,200)  band(91,120,201,300)
      band(121,250,301,400) band(251,500,401,500)
pm10: band(0,50,0,50)   band(51,100,51,100) band(101,250,101,200) band(251,350,201,300)
      band(351,430,301,400) band(431,600,401,500)
no2:  band(0,40,0,50)   band(41,80,51,100)  band(81,180,101,200)  band(181,280,201,300)
      band(281,400,301,400) band(401,600,401,500)
so2:  band(0,40,0,50)   band(41,80,51,100)  band(81,380,101,200)  band(381,800,201,300)
      band(801,1600,301,400) band(1601,2000,401,500)
co:   band(0,1,0,50)    band(1.1,2,51,100)  band(2.1,10,101,200)  band(10.1,17,201,300)
      band(17.1,34,301,400) band(34.1,50,401,500)
o3:   band(0,50,0,50)   band(51,100,51,100) band(101,168,101,200) band(169,208,201,300)
      band(209,748,301,400) band(749,1000,401,500)
nh3:  band(0,200,0,50)  band(201,400,51,100) band(401,800,101,200) band(801,1200,201,300)
      band(1201,1800,301,400) band(1801,2400,401,500)
```

Units: µg/m³ for all except CO (mg/m³) — correct. Averaging periods: PM2.5/PM10/NO₂/SO₂/NH₃ = 24 h,
CO/O₃ = 8 h — correct, and displayed in the UI.

**Result: 0 discrepancies across 84 boundary comparisons.**

---

## 3. Formula verification

`computeSubIndex` (`src/utils/aqi.ts:36-59`) performs linear interpolation inside a band:

```
subIndex = round( ((aqiHigh - aqiLow) / (concHigh - concLow)) * (conc - concLow) + aqiLow )
```

Hand-checked examples (computed before running, not derived from the code):

| Pollutant | Concentration | Hand calculation | Expected | Actual |
|---|---:|---|---:|---:|
| PM2.5 | 45 µg/m³ | 51 + (45−31)/(60−31)×49 = 74.655 | 75 | **75** |
| SO₂ | 100 µg/m³ | 101 + (100−81)/(380−81)×99 = 107.291 | 107 | **107** |
| NO₂ | 130 µg/m³ | 101 + (130−81)/(180−81)×99 = 150.0 | 150 | **150** |
| CO | 6 mg/m³ | 101 + (6−2.1)/(10−2.1)×99 = 149.873 | 150 | **150** |

### The three mandated regression cases

| Pollutant | Input | Expected CPCB sub-index | Actual | Result |
|---|---:|---:|---:|---|
| PM2.5 | 31 µg/m³ | 51 | **51** | PASS |
| CO | 1.1 mg/m³ | 51 | **51** | PASS |
| NH₃ | 201 µg/m³ | 51 | **51** | PASS |

These pass because the tables are modelled as true bands starting at 31 / 1.1 / 201 rather than as continuous
boundaries with a shared 0–500 threshold ladder — the exact failure mode the brief warned about.

---

## 4. Composite index verification

| Property | Required | Verified |
|---|---|---|
| Overall = **maximum** valid sub-index | Yes | PM2.5 31→51, PM10 60→60, NO₂ 40→50 ⇒ **60** (mean would be 53.67) |
| Dominant pollutant exposed | Yes | Returns the PM10 entry at 60 |
| ≥ 3 valid pollutants | Yes | 2 valid ⇒ `aqi:null`, `insufficient-coverage` |
| Must include PM2.5 or PM10 | Yes | NO₂+SO₂+CO valid ⇒ `aqi:null`, `hasParticulate:false` |
| PM10 alone satisfies the particulate rule | Yes | PM10+NO₂+SO₂ ⇒ AQI 51, `status:'ok'` |
| Missing values ignored, not zeroed | Yes | `null` ⇒ sub-index `null`, excluded from validity count |
| Negative / NaN / Infinity rejected | Yes | All return `null` |
| Beyond scale capped at 500 and flagged | Yes | PM2.5 900 ⇒ 500, `beyondScale:true` |
| Categories at exact boundaries | Yes | 50 Good, 51 Satisfactory, 100 Satisfactory, 101 Moderate, 200 Moderate, 201 Poor, 300 Poor, 301 Very Poor, 400 Very Poor, 401 Severe, 500 Severe |

---

## 5. Standards separation

| Distinction required | Implementation | Verified |
|---|---|---|
| CPCB National AQI vs US AQI | Only CPCB bands exist; category names are the Indian set (Good/Satisfactory/Moderate/Poor/Very Poor/Severe). No US EPA breakpoints or "Hazardous"/"Unhealthy" labels anywhere | Source review + grep |
| Official station reading vs model estimate | Separate cards; official card shows station + `last_update`, model card says "estimated CPCB-style model AQI" | Live payload + UI strings |
| Official AQI derived from concentrations | **Never** done. `api/aqi.ts` returns `aqi:null` when the provider supplies none | Live: Sonia Vihar, Delhi |
| Forecast vs observation | Hourly series labelled with local hour strings; no station claim | `aqiService.ts`, `date.ts` |
| Raw concentration vs index | Both displayed; the averaging-period column is shown | `AirQuality.tsx` |

**No mislabelling of Open-Meteo CAMS output as official CPCB data was found.** The phrase "CPCB-style" is
used deliberately to signal the averaging-period mismatch.

---

## 6. Provider audit

### 6.1 Open-Meteo air quality (`air-quality-api.open-meteo.com`)

| Check | Finding |
|---|---|
| Endpoint | `GET /v1/air-quality?latitude&longitude&current=…&hourly=…&forecast_days=2&timezone=auto` — correct |
| Credentials | None required; none sent |
| Parsing | Zod-validated shape; unknown fields ignored |
| Units | Provider returns µg/m³ for all seven; **CO divided by 1000** for mg/m³ breakpoints — verified live (`carbon_monoxide: 700.0` ⇒ 0.7 mg/m³) |
| Timestamps | Offset-less local strings (`2026-11-19T14:30`); never passed to `new Date()`; hour labels formatted as strings |
| Timezone | `timezone=auto` |
| Missing values | `ammonia:null` observed live; preserved as `null`, sub-index `null`, never zeroed |
| Freshness | `current` updates every 30 min vs weather every 15 min — the two are not merged |
| Failure handling | 9 s timeout, 1 retry on network/5xx, typed `HttpError`; weather failure is non-fatal |
| Caching | 10 min, keyed on 2-dp coordinates |
| Attribution | `SOURCE_METADATA.OPEN_METEO_MODEL` states it is model data, not a station observation |

### 6.2 Open-Meteo weather (`api.open-meteo.com`)

| Check | Finding |
|---|---|
| Fields | `temperature_2m °C`, `relative_humidity_2m %`, `wind_speed_10m km/h`, `weather_code wmo code` — all verified live |
| Nulls | `humidityPct`/`windKmh` are `number \| null`; rendered "Unavailable", never coerced to 0 |
| Failure | Non-fatal: the air-quality result still renders |
| Timestamp | `current.time` is offset-less local; treated as a display string |

### 6.3 data.gov.in / CPCB (`/api/aqi`)

| Check | Finding |
|---|---|
| Endpoint | `api.data.gov.in/resource/{id}?api-key=…` — key server-side only |
| Response shape | One row **per pollutant per station**; there is **no AQI field** in this resource |
| AQI handling | `aqi:null` unless the provider actually supplies a usable AQI (0–500). No derivation |
| Station selection | Groups pollutant rows by station, returns the most complete station |
| Fallback | Retries once with the trailing place name ("New Delhi" → "Delhi") — confirmed live |
| Units | CO surfaced as `unit:'as published'` because the resource does not state it |
| Placeholders | `NA`, `-` dropped, never zeroed |
| Freshness | `observedAt` passed through as published (`19-11-2026 14:00:00`) |
| Caching | 10 min when available, 3 min when not; `Cache-Control` matches |
| Input validation | **Gap** — arbitrary city strings are forwarded (SEC-M-02) |
| Attribution | "data.gov.in CPCB CAAQMS station data (official observation)" |

Observed live payload: PM10 160 (min 80, max 238), CO 90 ("as published"), O₃ 21, NH₃ 10, `aqi:null`,
station "Sonia Vihar, Delhi - DPCC". This is exactly the honest behaviour the brief demands.

### 6.4 Gemini (evaluated as a data path only; full AI review in `AI_EVALUATION_REPORT.md`)

Configured (`geminiConfigured:true`), default model `gemini-3.5-flash-lite`, one 18 s deadline with a single
retry on 503/429/5xx, fail-fast on 400/403. **Currently unreachable** because the function crashes before the
handler runs.

---

## 7. Impact of data-quality issues on scoring

| Issue | Severity | Effect |
|---|---|---|
| Pb absent | Low / documentation | 7 of 8 CPCB pollutants; should be declared |
| Instantaneous vs 24 h averaging | Disclosed | Not a defect; correctly labelled |
| Fractional gap interpolation | Informational | Undefined by CPCB; monotonic and documented |
| `/api/aqi` city validation | Medium (security) | Counted once, under Security |
| Official CO unit ambiguity | Disclosed | Correctly marked "as published" |

**Environmental data dimension: 14 / 15.** One mark deducted for the undeclared Pb omission. Everything the
audit could verify numerically was exact.

# Data methodology

This document explains exactly what every number on screen means, where it comes from, and what it must never
be called.

---

## 1. Source hierarchy

| Priority | Source | Kind | Used for |
| --- | --- | --- | --- |
| 1 | `api.data.gov.in` resource (CPCB-linked), when configured | **Official observation** | The separate "Official station" card: a published AQI when one exists, otherwise the station's published pollutant concentrations |
| 2 | — (third-party sensor networks) | Not integrated | — |
| 3 | Open-Meteo Air Quality (CAMS global model) | **Model estimate** | Dashboard AQI, pollutant table, hourly forecast, planner windows |

Vayu currently implements tiers 1 and 3. No third-party sensor network is integrated, and no tier is
simulated. The app does not have a "demo data" mode; demo readings were removed because they were
indistinguishable from live data.

**The two tiers are never merged.** They have separate cards, separate labels, separate timestamps and
separate wording. The dashboard AQI is always the model estimate. The official card is the only place an
official observation — a published AQI or the station's published concentrations — can appear.

---

## 2. CPCB National AQI

### 2.1 Breakpoints

From the CPCB National Air Quality Index methodology. CO is in mg/m³; all other pollutants in µg/m³.

| Pollutant | 0–50 | 51–100 | 101–200 | 201–300 | 301–400 | 401–500 |
| --- | --- | --- | --- | --- | --- | --- |
| PM2.5 (24 h) | 0–30 | 30–60 | 60–90 | 90–120 | 120–250 | 250–500 |
| PM10 (24 h) | 0–50 | 50–100 | 100–250 | 250–350 | 350–430 | 430–600 |
| NO₂ (24 h) | 0–40 | 40–80 | 80–180 | 180–280 | 280–400 | 400–600 |
| SO₂ (24 h) | 0–40 | 40–80 | 80–380 | 380–800 | 800–1600 | 1600–2000 |
| CO (8 h) | 0–1 | 1–2 | 2–10 | 10–17 | 17–34 | 34–50 |
| O₃ (8 h) | 0–50 | 50–100 | 100–168 | 168–208 | 208–748 | 748–1000 |
| NH₃ (24 h) | 0–200 | 200–400 | 400–800 | 800–1200 | 1200–1800 | 1800–2400 |

### 2.2 Sub-index

```
I = ((I_high − I_low) / (C_high − C_low)) × (C − C_low) + I_low
```

Linear interpolation inside the bracket containing the concentration, rounded to an integer. Concentration
above the last breakpoint is capped at 500 and flagged with `beyondScale`.

### 2.3 Overall index

```
AQI = max(sub-index over valid pollutants)
```

Not an average. Validity rules:

- the pollutant value must be present, finite and ≥ 0;
- at least **3** pollutants must be valid;
- at least one of PM2.5 or PM10 must be valid.

If either condition fails, `aqi` is `null`, `status` is `insufficient-coverage`, and the UI shows the reason
instead of a number. Missing pollutants are rendered as "Unavailable" — never imputed.

### 2.4 Categories

| AQI | Category |
| --- | --- |
| 0–50 | Good |
| 51–100 | Satisfactory |
| 101–200 | Moderate |
| 201–300 | Poor |
| 301–400 | Very Poor |
| 401–500 | Severe |

Categories are always shown with the numeric value; colour is supplementary.

---

## 3. Why model AQI is labelled "estimated"

Open-Meteo returns CAMS **instantaneous model concentrations** on a grid, not station observations. CPCB
sub-indices are defined for **24-hour (or 8-hour) averages measured at monitoring stations**. Therefore:

- the arithmetic is CPCB-correct;
- the input data is not CPCB measurement data;
- the result is a *CPCB-style estimate*, and is labelled exactly that way everywhere.

The pollutant table shows the CPCB averaging period next to each value so the mismatch is visible rather than
hidden. No averaging is fabricated: the app does not claim to compute a 24-hour average from a model field
without the underlying series, and it says so.

### Unit handling

`carbon_monoxide` is supplied in µg/m³ and divided by 1000 before applying the mg/m³ breakpoints. This
conversion is tested. Other pollutants are used as supplied.

### Time handling

Open-Meteo hourly timestamps are location-local ISO strings **without an offset** (`2026-11-18T14:00`).
Parsing them with `new Date()` would shift them into the browser timezone. Vayu:

- slices `HH:MM` for labels (`formatHourLabel`);
- compares `slice(0, 13)` strings to find the current hour (`startIndexFor`);
- builds a 24-point hourly series starting at the current hour.

---

## 4. Official data adapter

`GET /api/aqi?city=…`

1. Rate limit 60/min per client.
2. Require `city` (max 80 chars).
3. Serve from a 10-minute cache when official data is available, 3-minute cache otherwise.
4. Without `DATA_GOV_IN_API_KEY` / `DATA_GOV_IN_RESOURCE_ID`, return
   `{ available: false, reason: "Official CPCB provider is not configured on this deployment." }`.
5. Otherwise query `https://api.data.gov.in/resource/{id}` with `format=json`, `limit=100`, `filters[city]`.
   If the exact city returns no rows, retry once with the trailing place name (`New Delhi` → `Delhi`,
   `Navi Mumbai` → `Mumbai`).
6. Normalise keys case- and punctuation-insensitively (`pollutant_id` / `pollutantId`, `avg_value` /
   `pollutant_avg`).
7. **If a record contains a numeric AQI field** (`aqi`, `airqualityindex`, `overallaqi`, `aqivalue`) between
   0 and 500, return it as the official AQI.
8. **Otherwise**, if the records are pollutant rows, group them by station and return the most complete
   station as official concentrations. A station is the only valid grouping: the dataset publishes one row
   per pollutant per station, and mixing stations would invent a station that does not exist.
9. Drop placeholder values (`NA`, `-`, empty) instead of treating them as zero.
10. Pass through station name, optional distance (0–500 km, one decimal) and `last_update` **only when the
    provider supplies them**.
11. **Never** compute an "official AQI" from pollutant-only records.

The default resource — `3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69`, "Real time Air Quality Index from various
locations" — has no AQI field. It therefore produces `available: true` with `aqi: null` plus a
`pollutants[]` array. The UI labels that card "Official station concentrations" and states that the index
elsewhere in the app is the model estimate.

`pollutants[]` entries are `{ id, label, value, min, max, unit }` where `id` is one of `PM25`, `PM10`,
`NO2`, `SO2`, `CO`, `O3`, `NH3`. Particulates and gases are labelled µg/m³ (the CPCB reporting convention);
CO is labelled `as published` because this dataset does not state its unit and the observed value
distribution is not consistent with either µg/m³ or mg/m³. Asserting a unit would be a fabricated reading.

If the provider answers `429`, the reason string says the key is being rate-limited rather than showing a
number or a generic error.

The client re-validates the shape with Zod, rejects out-of-scale AQI values and non-finite concentrations, so
a changed or compromised upstream response cannot inject a bogus official number.

---

## 5. Weather

Open-Meteo forecast `current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`.
Weather is a separate request whose failure is non-fatal: the AQI card still renders, the weather card says
data is unavailable. Weather codes are mapped to short descriptions from the documented WMO code table.

If the provider omits an individual field, that field stays `null` and renders as "Unavailable" — humidity
and wind are never substituted with `0`, because a fabricated `0%` or `0 km/h` is a fabricated reading. If
temperature itself is missing, the whole weather card is treated as unavailable.

---

## 6. Forecast windows

`findBestWorstWindows(hourly, 2)`:

- slide a 2-hour window across the next 24 hourly points;
- skip any window containing a null AQI;
- average the AQI and PM2.5 inside each remaining window;
- report the lowest and highest.

This is why the app never claims "morning is cleanest". If the data says the cleanest window is 02:00–04:00,
that is what it reports. Windows are model estimates and are labelled as such; users are told to recheck.

---

## 7. Planner inputs

`buildPlanner({ assessment, hourly, profile })` uses:

- the computed assessment (AQI, category, dominant pollutant, coverage);
- the hourly series (windows);
- the profile (household composition, sensitivities, commute mode and distance, work timing, cooking fuel,
  ventilation, purifier ownership, room size, budget).

Thresholds used for tone: `> 100` elevated, `> 200` severe, `> 300` very high. These are guidance switches, not
risk scores.

Every recommendation carries: what, when, why, environmental context, beneficiaries, cost band, effort,
benefit type, evidence level, limitations and sources. Nothing is generated by an LLM.

---

## 8. Impact numbers

Only three quantitative models exist, all in `src/utils/impact.ts`:

| Model | Formula | Explicitly not |
| --- | --- | --- |
| Transport CO₂e | oneWayKm × 2 × days × 52 × kg/passenger-km (version `vayu-planning-2026.1`, ±20%) | a measurement of your vehicle |
| Exposure proxy | PM2.5 × hours outdoors (µg/m³·h) | inhaled dose, medical risk, a health benefit |
| Purifier sizing | room volume (m³) × ACH target (4–6) | a predicted indoor PM2.5 reduction |

Household and community alternatives (`src/constants/alternatives.ts`) are qualitative. A test fails if a
kg/tonne figure is introduced into them. No cigarette-equivalence conversion exists anywhere in the codebase.

---

## 9. Provenance checklist for any new data source

Before adding a provider, answer all of these in code and in the UI:

1. Is this an observation, a model output, or a derived estimate?
2. What spatial and temporal resolution does it have?
3. Which averaging period does it use, and does it match CPCB?
4. What licence and attribution are required?
5. What happens when it fails, rate-limits, or returns partial data?
6. How is it labelled so a user cannot confuse it with an official CPCB reading?

If any answer is unknown, the UI must say "unavailable" rather than imply confidence.

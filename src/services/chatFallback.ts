// NOTE: the explicit `.js` extension is required. This module is imported by the
// Vercel functions in `api/`, which run on Node's ESM loader. Node does not do
// extensionless resolution, so omitting `.js` crashes the function at link time
// with ERR_MODULE_NOT_FOUND before any handler code runs. Vite resolves it either
// way, which is why the unit tests never caught it.
import { SOURCE_METADATA, type SourceId } from '../constants/sources.js'
import type { ChatAnswer, Profile } from '../types'

export interface ChatContext {
  city: string
  aqi: number | null
  category: string | null
  pm25: number | null
  bestWindow: string | null
  worstWindow: string | null
  profile: Pick<Profile, 'roomAreaSqFt' | 'commute' | 'budget' | 'children' | 'elderly' | 'respiratorySensitivity' | 'cardiovascularSensitivity'>
}

export type ChatIntent =
  | 'exercise' | 'purifier' | 'ventilation' | 'children' | 'elderly' | 'commute'
  | 'mask' | 'severe' | 'exposure' | 'indoor' | 'impact'
  | 'ambient' | 'definition' | 'pregnancy' | 'worker' | 'medical' | 'device'
  | 'unknown'

/**
 * Deterministic intent routing for the no-API-key / provider-outage path.
 *
 * Ordering is deliberate: out-of-scope small talk is rejected first so no
 * general keyword can rescue it, then safety-critical categories, then the
 * domain intents from most specific to most general. The previous version
 * returned `unknown` for "What is the air quality right now?" and
 * "What causes indoor air pollution?", which are the two most likely first
 * questions an air-quality assistant receives.
 */
export function classifyChatIntent(question: string): ChatIntent {
  const q = question.toLowerCase()

  // 1. Out-of-scope small talk. Must never be rescued by a later keyword match.
  if (/(sourdough|recipe|football|cricket score|movie|film|song|joke|weather tomorrow|stock price|capital of)/.test(q)) return 'unknown'

  // 2. Requests for personal medical judgement get an explicit safe refusal.
  if (/(diagnos|prescrib|medicine|medication|inhaler|tablet|syrup|dose|dosage|asthma attack|chest pain|symptom)/.test(q)) return 'medical'

  // 3. Ozone-producing devices. These must be refused explicitly rather than
  //    deflected with a topic menu, and they precede `purifier` because the
  //    question often contains the word "purifier".
  if (/(ozone|ozoniser|ozonizer|ioniser|ionizer)/.test(q)) return 'device'

  // 4. Emission, offset and city-scale impact claims.
  if (/(immediately|exact (?:amount|number)|lower (?:the )?(?:city )?aqi|change (?:the )?aqi|emission|carbon|co2|impact simulator|offset|footprint)/.test(q)) return 'impact'

  // 5. Definitions of a pollutant or of the index itself.
  if (/(what (?:is|does|are) [^?]{0,24}\b(?:pm\s?2\.5|pm\s?10|pm25|pm10|aqi|no2|nitrogen dioxide|so2|sulphur dioxide|ozone|o3|nh3|carbon monoxide)\b|meaning of (?:pm|aqi)|\bwhat does (?:pm|aqi)\b)/.test(q)) return 'definition'

  // 6. Ambient "how is the air right now" — the most common opening question.
  if (/(what(?:'s| is) the (?:air quality|aqi|pollution(?: level)?)|how (?:is|are) the air|air quality (?:right now|today|currently)|current (?:air quality|aqi|pollution)|pollution level|is the air (?:bad|clean|safe) (?:today|right now)|how bad is the air)/.test(q)) return 'ambient'

  // 7. Vulnerable groups that the profile does not model as a field.
  if (/\b(?:pregnan\w*|expecting a baby|first trimester|second trimester|third trimester)\b/.test(q)) return 'pregnancy'
  if (/\b(?:outdoor worker|work outside|work outdoors|delivery (?:rider|driver)|construction (?:worker|site)|traffic police|security guard|courier|field work)\b/.test(q)) return 'worker'

  // 8. Time-outdoors questions are exposure questions, not exercise questions.
  if (/(exposure|inhaled|breathe|breathing rate|how (?:long|many hours) [^?]{0,24}(?:outside|outdoors|stay out))/.test(q)) return 'exposure'

  // 9. Household-specific intents. Children before commute so "child travel to
  //    school" is treated as a children question, not a commute question.
  if (/(child|children|school|kid|baby|student)/.test(q)) return 'children'
  if (/(elderly|older adult|senior|grandparent)/.test(q)) return 'elderly'
  if (/(mask|n95|n-95|ffp2|respirator)/.test(q)) return 'mask'

  // 10. Word-boundary matching. The old patterns matched "open" inside
  //     "open source" and "run" inside "running late".
  if (/\b(?:windows?|ventilat\w*|airing|air out)\b/.test(q)) return 'ventilation'
  if (/(purifier|filter|hep|cadr|air cleaner)/.test(q)) return 'purifier'
  if (/\b(?:commute|metro|bus|carpool|drive|car|two-wheeler|cycling to work|travel)\b/.test(q)) return 'commute'
  // "reduce indoor PM2.5 by 90%" is a source-control question, not small talk.
  if (/(cooking|indoor source|indoor air|indoor pm|indoor pollut|incense|smok|dust|mop|source control)/.test(q)) return 'indoor'
  if (/(severe|emergency|aqi 400|hazard)/.test(q)) return 'severe'
  if (/\b(?:run|running|jog|jogging|exercise|work\s?out|cycling|walk|walking|outside|outdoor)\b/.test(q)) return 'exercise'

  return 'unknown'
}

function sourceIds(context: ChatContext): SourceId[] {
  const sources: SourceId[] = []
  if (context.aqi !== null || context.pm25 !== null) sources.push('OPEN_METEO_MODEL')
  if (context.aqi !== null) sources.push('CPCB_AQI_METHODOLOGY')
  return sources
}

export function fallbackChatAnswer(question: string, context: ChatContext): ChatAnswer {
  const intent = classifyChatIntent(question)
  const hasAqi = context.aqi !== null
  const aqi = hasAqi ? `estimated CPCB-style model AQI ${context.aqi} (${context.category ?? 'category unavailable'})` : 'model AQI is unavailable'
  const window = context.bestWindow ? ` Use the lower-forecast window ${context.bestWindow} where practical.` : ' No cleaner hourly window is available.'
  const high = context.aqi !== null && context.aqi > 200
  const elevated = context.aqi !== null && context.aqi > 100
  const profile = context.profile
  const pm25 = context.pm25 === null ? 'unavailable' : `${context.pm25} µg/m³`

  // Budget-aware filtration advice. Mirrors the branching the planner already
  // applies in recommendationService.ts so chat and the plan do not disagree.
  const tightBudget = profile.budget === 'Free' || profile.budget.startsWith('Under')
  const purifierAdvice = tightBudget
    ? `For your ${profile.roomAreaSqFt} sq ft room, prioritise source control and damp cleaning first. If you consider a certified HEPA purifier later, match its rated CADR to the room rather than buying the cheapest unit, and check replacement-filter costs. Avoid ozone-generating devices and improvised electrical filters.`
    : `For your ${profile.roomAreaSqFt} sq ft room, compare a certified HEPA purifier's independently rated CADR with the room size and check replacement-filter costs. A unit rated for roughly this room at 4–5 air changes per hour is appropriately sized; verify the rating on the label. Avoid ozone-generating devices and improvised electrical filters.`

  const answers: Record<ChatIntent, string> = {
    ambient: hasAqi
      ? `Right now the ${aqi} for ${context.city}, with model PM2.5 at ${pm25}. This is a model estimate, not an official CPCB station reading.${window}`
      : `Model air-quality data for ${context.city} is not available right now, so I will not state a number. Air-quality readings come from the live model feed only; a failed or missing reading is shown as unavailable rather than filled in.${window}`,
    definition: hasAqi
      ? `PM2.5 is particulate matter 2.5 micrometres or smaller; PM10 is 10 micrometres or smaller. The AQI is one index built from the worst valid pollutant sub-index using CPCB breakpoints, capped at 500. Right now ${context.city} is at ${aqi} with PM2.5 at ${pm25}.${window}`
      : `PM2.5 is particulate matter 2.5 micrometres or smaller; PM10 is 10 micrometres or smaller. The AQI is one index built from the worst valid pollutant sub-index using CPCB breakpoints, capped at 500. Model readings are unavailable right now, so I cannot quote a current value.${window}`,
    exercise: !hasAqi
      ? `Live model air-quality data is unavailable right now, so I will not estimate a safe exercise level. Keep outdoor exercise light and check local conditions before a long session.${window}`
      : high
        ? `With ${aqi}, avoid strenuous outdoor exercise and choose an indoor activity. Keep essential outdoor trips short.${window}`
        : `For ${aqi}, keep outdoor exercise light and plan around a lower-pollution period when available.${window}`,
    purifier: `${purifierAdvice}${window}`,
    ventilation: elevated
      ? `With ${aqi}, avoid opening windows during higher-pollution periods. Ventilate briefly only when the outdoor forecast is lower and indoor sources need clearing.${window}`
      : `Use a short ventilation period when outdoor pollution is lower, especially after cooking. If forecast data is missing, check local conditions before opening windows.${window}`,
    children: `For children, keep strenuous outdoor play flexible and plan essential school travel for a lower-pollution period. Follow school and local public-health guidance.${window}`,
    elderly: `For older household members, reduce strenuous outdoor activity during higher-pollution periods and keep essential errands flexible. Follow their clinician's advice for personal health concerns.${window}`,
    pregnancy: `Pregnancy is a reasonable time to reduce avoidable air-pollution exposure, but personal health questions belong with an antenatal clinician. Practical steps: keep outdoor time flexible around the higher-pollution period, use a well-fitting respirator for essential travel if it is comfortable, and keep indoor source control strong.${window}`,
    worker: `Outdoor work usually cannot move indoors, so focus on reducing peak exposure: shift strenuous tasks away from the higher-pollution period, take breaks in filtered indoor air where available, and use a well-fitting respirator for sustained outdoor work. Ask your employer about task rotation and filtered break areas.${window}`,
    commute: `Your saved commute is ${profile.commute}. Consider public transport or carpooling when practical, choose lower-traffic routes, and time essential trips for lower outdoor pollution. A travel-mode change does not immediately change city AQI.${window}`,
    mask: `For essential outdoor travel during high particulate pollution, a well-fitting particulate respirator may reduce particle exposure. Fit matters; it does not replace reducing time outdoors or following public-health advice.${window}`,
    severe: hasAqi
      ? `For ${aqi}, keep outdoor time short, avoid strenuous activity, and follow current local public-health instructions. Do not treat this model estimate as an official station reading.${window}`
      : `Live model air-quality data is unavailable, so I cannot confirm a severe reading. Keep outdoor time short where conditions look poor and follow current local public-health instructions.${window}`,
    exposure: `Exposure depends on both concentration and time outdoors. Vayu can show a PM2.5 concentration-time proxy when hourly data is available; it is not inhaled dose or medical risk. There is no safe fixed number of outdoor hours, so shorten time outdoors when ${hasAqi ? `the estimate is ${context.aqi}` : 'readings are elevated'} and use the cleaner window where you can.${window}`,
    indoor: 'Use kitchen exhaust during cooking, avoid indoor smoking and unnecessary combustion, and damp-dust rather than dry-sweep. These are source-control steps. Vayu does not predict a percentage reduction in indoor concentration, so treat any specific "cut it by 90%" target as unsupported.',
    impact: 'A transport choice changes your estimated personal transport emissions, and Vayu computes that in the Impact simulator from the published per-km factors with a ±20% band. Chat does not do the arithmetic and does not invent a figure. A mode shift does not produce an immediate city-wide AQI change.',
    device: 'Do not use an ozone generator or an ioniser that intentionally produces ozone. Ozone is an airway irritant, and it does not remove particles from indoor air. For particles, mechanical filtration through a certified HEPA unit is the appropriate approach, sized to the room, and source control comes first. This is general environmental-health information, not a product recommendation.',
    medical: 'I cannot offer personal medical advice or assess symptoms. For breathing difficulty, chest pain or a persistent cough, contact a qualified clinician. For air-quality decisions I can help with exposure timing, indoor source control and mask fit.',
    unknown: `I can help with air quality, exposure planning, indoor sources, family precautions, commute choices, or estimated transport impacts. Right now ${aqi}${context.bestWindow ? `, and the lower-forecast window is ${context.bestWindow}` : ''}. Ask about one of those topics and I will use the available local context.`,
  }

  const text = answers[intent]
  return {
    answer: `${text} This is general environmental-health information, not a diagnosis or medical treatment.`,
    sources: sourceIds(context),
    source: 'fallback',
  }
}

const INTENT_TERMS: Record<Exclude<ChatIntent, 'unknown'>, RegExp> = {
  ambient: /air quality|AQI|PM\s?2\.5|model estimate/i,
  definition: /PM\s?2\.5|particulate|AQI|index/i,
  exercise: /exercise|run|activity|exertion|outdoor|workout/i,
  purifier: /purifier|filter|CADR|HEPA|ozone/i,
  ventilation: /window|ventilat|airing|outdoor pollution/i,
  children: /child|school|play|student|family/i,
  elderly: /older adult|elderly|senior|errand|activity/i,
  pregnancy: /pregnan|antenatal|clinician|exposure/i,
  worker: /outdoor work|employer|respirator|exposure/i,
  medical: /medical advice|clinician|symptom/i,
  commute: /commut|metro|bus|carpool|travel|route|AQI/i,
  mask: /mask|respirator|particle|fit/i,
  severe: /outdoor|strenuous|pollution|local|AQI/i,
  exposure: /exposure|concentration|time|dose|PM\s?2\.5/i,
  indoor: /indoor|cooking|source|dust|smok|exhaust/i,
  impact: /transport|emission|CO₂e|CO2|city-wide|impact|simulator|AQI/i,
  device: /ozone|ionis|ioniz|HEPA|filter/i,
}

export function isChatAnswerRelevant(question: string, answer: string): boolean {
  const intent = classifyChatIntent(question)
  if (intent === 'unknown') return /air quality|pollution|environment|Vayu/i.test(answer)
  return INTENT_TERMS[intent].test(answer)
}

export function sourceLabel(id: SourceId): string {
  return SOURCE_METADATA[id].name
}

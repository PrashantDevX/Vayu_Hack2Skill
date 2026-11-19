import { SOURCE_METADATA, type SourceId } from '../constants/sources'
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
  | 'mask' | 'severe' | 'exposure' | 'indoor' | 'impact' | 'unknown'

export function classifyChatIntent(question: string): ChatIntent {
  const q = question.toLowerCase()
  if (/(sourdough|recipe|football|movie|weather tomorrow)/.test(q)) return 'unknown'
  if (/(immediately|exact (?:amount|number)|lower (?:the )?(?:city )?aqi|change (?:the )?aqi|emission|carbon|co2|impact simulator)/.test(q)) return 'impact'
  if (/(exposure|inhaled|breathe|breathing rate)/.test(q)) return 'exposure'
  if (/(child|children|school|kid|baby|student)/.test(q)) return 'children'
  if (/(elderly|older adult|senior|grandparent)/.test(q)) return 'elderly'
  if (/(mask|n95|n-95|ffp2|respirator)/.test(q)) return 'mask'
  if (/(window|ventilat|open|airing)/.test(q)) return 'ventilation'
  if (/(purifier|filter|hep|air cleaner|cadr)/.test(q)) return 'purifier'
  if (/(commute|metro|bus|carpool|drive|car|two-wheeler|cycling to work|travel)/.test(q)) return 'commute'
  if (/(cooking|indoor source|incense|smok|dust|mop|source control)/.test(q)) return 'indoor'
  if (/(severe|emergency|aqi 400|hazard)/.test(q)) return 'severe'
  if (/(run|jog|exercise|work ?out|cycling|walk)/.test(q)) return 'exercise'
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

  const answers: Record<ChatIntent, string> = {
    exercise: high
      ? `With ${aqi}, avoid strenuous outdoor exercise and choose an indoor activity. Keep essential outdoor trips short.${window}`
      : `For ${aqi}, keep outdoor exercise light and plan around a lower-pollution period when available.${window}`,
    purifier: `For your ${profile.roomAreaSqFt} sq ft room, compare a certified HEPA purifier's independently rated CADR with the room size and check replacement-filter costs. Avoid ozone-generating devices and improvised electrical filters.${window}`,
    ventilation: elevated
      ? `With ${aqi}, avoid opening windows during higher-pollution periods. Ventilate briefly only when the outdoor forecast is lower and indoor sources need clearing.${window}`
      : `Use a short ventilation period when outdoor pollution is lower, especially after cooking. If forecast data is missing, check local conditions before opening windows.${window}`,
    children: `For children, keep strenuous outdoor play flexible and plan essential school travel for a lower-pollution period. Follow school and local public-health guidance.${window}`,
    elderly: `For older household members, reduce strenuous outdoor activity during higher-pollution periods and keep essential errands flexible. Follow their clinician's advice for personal health concerns.${window}`,
    commute: `Your saved commute is ${profile.commute}. Consider public transport or carpooling when practical, choose lower-traffic routes, and time essential trips for lower outdoor pollution. A travel-mode change does not immediately change city AQI.${window}`,
    mask: `For essential outdoor travel during high particulate pollution, a well-fitting particulate respirator may reduce particle exposure. Fit matters; it does not replace reducing time outdoors or following public-health advice.${window}`,
    severe: `For ${aqi}, keep outdoor time short, avoid strenuous activity, and follow current local public-health instructions. Do not treat this model estimate as an official station reading.${window}`,
    exposure: `Exposure depends on both concentration and time outdoors. Vayu can show a PM2.5 concentration-time proxy when hourly data is available; it is not inhaled dose or medical risk.${window}`,
    indoor: 'Use kitchen exhaust during cooking, avoid indoor smoking and unnecessary combustion, and damp-dust rather than dry-sweep. These are source-control steps; no indoor concentration reduction is predicted.',
    impact: 'A transport choice can change estimated personal transport emissions under the simulator assumptions. It does not produce an immediate city-wide AQI change, and Vayu does not invent a precise AQI reduction.',
    unknown: 'I can help with air quality, exposure planning, indoor sources, family precautions, commute choices, or estimated transport impacts. Ask about one of those topics and I will use the available local context.',
  }

  const text = answers[intent]
  return {
    answer: `${text} This is general environmental-health information, not a diagnosis or medical treatment.`,
    sources: sourceIds(context),
    source: 'fallback',
  }
}

const INTENT_TERMS: Record<Exclude<ChatIntent, 'unknown'>, RegExp> = {
  exercise: /exercise|run|activity|exertion|outdoor|workout/i,
  purifier: /purifier|filter|CADR|HEPA|ozone/i,
  ventilation: /window|ventilat|airing|outdoor pollution/i,
  children: /child|school|play|student|family/i,
  elderly: /older adult|elderly|senior|errand|activity/i,
  commute: /commut|metro|bus|carpool|travel|route|AQI/i,
  mask: /mask|respirator|particle|fit/i,
  severe: /outdoor|strenuous|pollution|local|AQI/i,
  exposure: /exposure|concentration|time|dose|PM2.5/i,
  indoor: /indoor|cooking|source|dust|smok|exhaust/i,
  impact: /transport|emission|AQI|city-wide|impact/i,
}

export function isChatAnswerRelevant(question: string, answer: string): boolean {
  const intent = classifyChatIntent(question)
  if (intent === 'unknown') return /air quality|pollution|environment|Vayu/i.test(answer)
  return INTENT_TERMS[intent].test(answer)
}

export function sourceLabel(id: SourceId): string {
  return SOURCE_METADATA[id].name
}

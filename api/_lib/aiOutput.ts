import type { SourceId } from '../../src/constants/sources.js'
import { classifyChatIntent, isChatAnswerRelevant } from '../../src/services/chatFallback.js'

export type AiRejectionCode =
  | 'ozone_device'
  | 'unsafe_diy_filtration'
  | 'medical_treatment'
  | 'unsupported_reduction'
  | 'blind_ventilation'
  | 'unsupported_aqi_change'
  | 'irrelevant'

export interface AiSafetyContext {
  aqi: number | null
}

const SAFETY_RULES: readonly { code: AiRejectionCode; pattern: RegExp }[] = [
  { code: 'ozone_device', pattern: /\b(?:ozone generator|ozone-producing (?:device|air cleaner|purifier)|ozone air purifier|ozone-based air cleaner)\b/i },
  {
    code: 'unsafe_diy_filtration',
    pattern: /\b(?:DIY|homemade|home-built|improvised|box[- ]fan|MERV|wire|tape|attach|strap|mount|build|construct|assemble)\b.{0,100}\b(?:filter|fan|filtration|air cleaner|purifier|electrical)\b|\b(?:filter|fan)\b.{0,100}\b(?:tape|attach|strap|mount|wire|build|construct|assemble)\b/i,
  },
  { code: 'medical_treatment', pattern: /\b(?:diagnos(?:e|is)|prescrib(?:e|ing)|medication|medicine|drug dosage|dose of)\b/i },
  { code: 'unsupported_reduction', pattern: /(?:\b\d+(?:\.\d+)?\s?%\b.{0,80}\b(?:pollut|PM\s?2\.5|indoor air|reduc|remov|improv)|\b(?:pollut|PM\s?2\.5|indoor air)\b.{0,80}\b\d+(?:\.\d+)?\s?%)/i },
  { code: 'unsupported_aqi_change', pattern: /(?:\b(?:lower|reduce|improve|change)\b.{0,80}\b(?:city(?:-wide)?\s+)?AQI\b.{0,50}\b(?:by\s+\d|immediately|instantly|exactly)\b|\b(?:immediately|instantly)\b.{0,40}\b(?:lower|reduce|improve|change)\b.{0,40}\bAQI\b)/i },
]

export function inspectAiText(text: string, context: AiSafetyContext): AiRejectionCode[] {
  const rejected = SAFETY_RULES.filter(rule => rule.pattern.test(text)).map(rule => rule.code)
  if (
    context.aqi !== null && context.aqi > 100 &&
    /\b(?:open|keep open|leave open)\b.{0,35}\bwindows?\b/i.test(text) &&
    !/\b(?:cleaner|lower|better|less polluted) (?:forecast )?window\b/i.test(text)
  ) rejected.push('blind_ventilation')
  return rejected
}

const PLAN_TITLE_INTENTS: Record<string, RegExp> = {
  'Morning routine': /morning|window|ventilat|indoor|pollut/i,
  Commute: /commut|metro|bus|carpool|travel|route|traffic/i,
  'Outdoor activity': /outdoor|exercise|activity|exertion|pollut/i,
  'Indoor environment': /indoor|source|filter|purifier|cooking|ventilat/i,
  'School and children': /school|child|student|play|travel/i,
  'Elderly precautions': /older|elderly|senior|exertion|errand|activity/i,
  'Evening routine': /evening|window|ventilat|forecast|pollut/i,
  'Night-time environment': /night|sleep|indoor|filter|purifier|source/i,
}

export function isPlanSectionRelevant(title: string, guidance: string): boolean {
  return PLAN_TITLE_INTENTS[title]?.test(guidance) ?? false
}

export function isChatOutputRelevant(question: string, answer: string): boolean {
  return isChatAnswerRelevant(question, answer) && classifyChatIntent(question) !== 'unknown'
}

export function chatSourceIds(context: { aqi: number | null; pm25: number | null }): SourceId[] {
  const ids: SourceId[] = []
  if (context.aqi !== null || context.pm25 !== null) ids.push('OPEN_METEO_MODEL')
  if (context.aqi !== null) ids.push('CPCB_AQI_METHODOLOGY')
  return ids
}

export function planSourceIds(body: {
  location: { aqi: number | null; pm25: number | null }
  windows: { best: unknown; worst: unknown }
}): SourceId[] {
  const ids: SourceId[] = []
  if (body.location.aqi !== null || body.location.pm25 !== null || body.windows.best || body.windows.worst) ids.push('OPEN_METEO_MODEL')
  if (body.location.aqi !== null) ids.push('CPCB_AQI_METHODOLOGY')
  return ids
}

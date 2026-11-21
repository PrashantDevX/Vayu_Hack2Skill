import type { AqiAssessment, PlannerResult } from '../types'

export interface ShareSummaryInput {
  city: string
  assessment: AqiAssessment | undefined
  planner: PlannerResult
  /** How many actions to include. Kept short so it fits in one message. */
  maxActions?: number
}

/**
 * Recommendations that only appear because of a saved household detail. They
 * stay in the app; they are never copied into a message the user forwards.
 */
const HOUSEHOLD_SPECIFIC_IDS: ReadonlySet<string> = new Set([
  'school-protection',
  'elderly-precautions',
  'outdoor-worker',
])

/**
 * Plain-text summary for passing guidance to family, neighbours or a community
 * group. It is built only from values the app already holds (model AQI,
 * planner windows, deterministic actions) and deliberately carries no household
 * composition, location coordinates or device identifiers: the household-specific
 * recommendations (school, older adults, outdoor worker) are left out, so a
 * forwarded message does not disclose who lives in the home.
 */
export function buildShareText({ city, assessment, planner, maxActions = 3 }: ShareSummaryInput): string {
  const aqi = assessment?.aqi ?? null
  const category = assessment?.category ?? null
  const lines: string[] = [`Vayu household air-quality summary — ${city}`]

  lines.push(
    aqi === null || category === null
      ? 'Estimated CPCB-style model AQI is unavailable right now (insufficient pollutant coverage).'
      : `Estimated CPCB-style model AQI ${aqi} (${category}).`,
  )

  lines.push(
    planner.bestWindow
      ? `Relatively cleaner window: ${planner.bestWindow.start}–${planner.bestWindow.end}.`
      : 'Relatively cleaner window: not identified from the current hourly series.',
  )
  if (planner.worstWindow) {
    lines.push(`Higher-pollution window: ${planner.worstWindow.start}–${planner.worstWindow.end}.`)
  }

  const actions = planner.recommendations
    .filter(item => !HOUSEHOLD_SPECIFIC_IDS.has(item.id))
    .slice(0, Math.max(0, maxActions))
  if (actions.length > 0) {
    lines.push('', 'Today’s actions:')
    actions.forEach((item, index) => lines.push(`${index + 1}. ${item.title} — ${item.action}`))
  }

  lines.push(
    '',
    'Model estimate from Open-Meteo CAMS, not an official CPCB station reading. General public-health information, not medical advice.',
  )
  return lines.join('\n')
}

/** Clipboard write with an explicit failure result instead of a thrown error. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // A denied permission is reported to the caller, not swallowed silently.
  }
  return false
}

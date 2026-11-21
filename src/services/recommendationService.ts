import { CATEGORY_SUMMARY, DEFAULT_PROFILE } from '../constants/aqi'
import type {
  AqiAssessment,
  AiBrief,
  HourlyPoint,
  PlannerResult,
  PollutionWindow,
  Profile,
  Recommendation,
  RecommendationCategory,
} from '../types'
import { dominantPollutant } from '../utils/aqi'
import { estimateCadr } from '../utils/impact'

const SOURCES = {
  cpcb: 'CPCB_AQI_METHODOLOGY',
  who: 'WHO_AIR_QUALITY_GUIDELINES',
  cams: 'OPEN_METEO_MODEL',
} as const

const BASE_LIMITATION =
  'Model concentrations are not official CPCB station observations. Guidance is general public-health information, not a diagnosis or prescription.'

function addHours(label: string, hours: number): string {
  const match = /^(\d{2}):(\d{2})$/.exec(label)
  if (!match) return label
  const hour = Number(match[1])
  const minute = match[2] ?? '00'
  return `${String((hour + hours) % 24).padStart(2, '0')}:${minute}`
}

export function findBestWorstWindows(hourly: HourlyPoint[], windowHours = 2): {
  best: PollutionWindow | null
  worst: PollutionWindow | null
} {
  if (windowHours < 1) throw new Error('Window length must be at least one hour')
  const candidates: PollutionWindow[] = []

  for (let index = 0; index + windowHours <= hourly.length; index += 1) {
    const slice = hourly.slice(index, index + windowHours)
    if (slice.some(point => point.aqi === null || point.aqi === undefined)) continue
    const aqiValues = slice.map(point => point.aqi as number)
    const pm25Values = slice.map(point => point.pm25).filter((value): value is number => value !== null)
    const first = slice[0]
    const last = slice[slice.length - 1]
    if (!first || !last) continue
    const averageAqi = aqiValues.reduce((sum, value) => sum + value, 0) / aqiValues.length
    candidates.push({
      start: first.label,
      end: addHours(last.label, 1),
      averageAqi: Math.round(averageAqi),
      averagePm25:
        pm25Values.length === 0
          ? null
          : Math.round((pm25Values.reduce((sum, value) => sum + value, 0) / pm25Values.length) * 10) / 10,
    })
  }

  if (candidates.length === 0) return { best: null, worst: null }
  const sorted = [...candidates].sort((a, b) => (a.averageAqi ?? 0) - (b.averageAqi ?? 0))
  return { best: sorted[0] ?? null, worst: sorted[sorted.length - 1] ?? null }
}

function describeContext(assessment: AqiAssessment, best: PollutionWindow | null, worst: PollutionWindow | null): string {
  if (assessment.aqi === null || assessment.category === null) {
    return 'Model AQI is unavailable because pollutant coverage is insufficient. No AQI number is shown or inferred.'
  }
  const dominant = dominantPollutant(assessment)
  const dominantText = dominant ? `${dominant.label} is the dominant sub-index` : 'Sub-index detail is unavailable'
  const windowText =
    best === null
      ? 'No reliable hourly comparison window is available'
      : `Relatively cleaner window: ${best.start}–${best.end} (estimated AQI ${best.averageAqi ?? 'unavailable'})`
  const worstText =
    worst === null
      ? ''
      : `; higher-pollution window: ${worst.start}–${worst.end} (estimated AQI ${worst.averageAqi ?? 'unavailable'})`
  return `Estimated CPCB-style model AQI ${assessment.aqi} (${assessment.category}). ${dominantText}. ${windowText}${worstText}.`
}

/** Household members who benefit, derived only from the saved profile. */
function beneficiariesFor(profile: Profile, exclude: readonly string[] = []): string[] {
  const household = ['Everyone in the household']
  if (profile.children > 0) household.push('Children')
  if (profile.elderly > 0) household.push('Older adults')
  if (profile.outdoorWorker) household.push('Outdoor worker')
  if (profile.respiratorySensitivity || profile.cardiovascularSensitivity) household.push('Sensitive adults')
  return household.filter(item => !exclude.includes(item))
}

export interface PlanInput {
  assessment: AqiAssessment
  hourly: HourlyPoint[]
  profile?: Profile
  now?: Date
}

export function buildPlanner(input: PlanInput): PlannerResult {
  const profile = input.profile ?? DEFAULT_PROFILE
  const now = input.now ?? new Date()
  const { assessment, hourly } = input
  const { best, worst } = findBestWorstWindows(hourly, 2)
  const context = describeContext(assessment, best, worst)
  const aqi = assessment.aqi
  const category = assessment.category
  const isElevated = aqi !== null && aqi > 100
  const isSevere = aqi !== null && aqi > 200
  const isVeryHigh = aqi !== null && aqi > 300
  const bestLabel = best ? `${best.start}–${best.end}` : 'a lower-pollution forecast window, once available'
  const worstLabel = worst ? `${worst.start}–${worst.end}` : 'the highest-pollution forecast window'
  const householdBeneficiaries = beneficiariesFor(profile)

  const indoorBudget = profile.budget
  const cadr = estimateCadr({ areaSqFt: profile.roomAreaSqFt })
  const purifierAdvice = profile.hasPurifier
    ? `Check that your purifier's rated CADR is at least ${cadr.cadrM3hLow}–${cadr.cadrM3hHigh} m³/h for the configured room, and clean or replace filters on schedule.`
    : indoorBudget === 'Free' || indoorBudget === 'Under ₹1,500'
      ? 'Prioritise source control and damp cleaning first. If you consider a purifier later, match a certified HEPA unit to the room CADR rather than buying the cheapest unit.'
      : `A certified HEPA unit rated around ${cadr.cadrM3hLow}–${cadr.cadrM3hHigh} m³/h would be appropriately sized for a ${profile.roomAreaSqFt} sq ft room at ${cadr.achLow}–${cadr.achHigh} air changes per hour. Verify the rated CADR on the label.`

  const commuteAdvice =
    profile.commute === 'Petrol car' || profile.commute === 'Two-wheeler'
      ? `Replace solo ${profile.commute.toLowerCase()} trips with metro, bus or carpool where practical. If driving is unavoidable, combine errands and avoid the busiest roadside corridors during ${worstLabel}.`
      : profile.commute === 'Carpool'
        ? 'Keep the carpool full; fewer vehicles for the same trips reduces personal transport emissions and roadside exposure.'
        : profile.commute === 'Walking or cycling'
          ? `Use quieter side streets away from traffic during ${bestLabel}; if the estimated AQI is high, reduce strenuous travel or use public transport instead.`
          : `Continue using public transport and plan the trip for ${bestLabel} when possible.`

  const morningAction = isElevated
    ? `Keep windows closed through the morning and rely on indoor source control until ${bestLabel}.`
    : `Use the cleaner morning window (${bestLabel}) for ventilation and outdoor errands.`
  const eveningAction = isElevated
    ? `Check the hourly forecast before reopening windows. If ${bestLabel} still has an elevated index, keep windows closed and run filtration or source control.`
    : `Open windows briefly during ${bestLabel}, then close them if outdoor levels rise.`

  // Each recommendation is declared once, then composed in reading order below.
  const morning: Recommendation = {
    id: 'morning-windows',
    title: isElevated ? 'Protect the morning indoor environment' : 'Use the cleaner morning window',
    category: 'morning',
    action: morningAction,
    suggestedTime: isElevated ? `Until ${best?.start ?? 'the next cleaner window'}` : best?.start ?? 'Morning',
    explanation: isElevated
      ? 'Outdoor particulate levels are elevated. Closing windows reduces outdoor particle ingress while indoor cooking and dust sources are controlled.'
      : 'The forecast shows a relatively lower-pollution period, so short ventilation can refresh indoor air without a large pollution penalty.',
    environmentalContext: context,
    beneficiaries: [...householdBeneficiaries],
    cost: 'Free',
    effort: 'Low',
    benefitType: 'Lower indoor exposure during a higher-pollution period',
    evidenceLevel: 'Established',
    limitations: `${BASE_LIMITATION} Ventilation decisions must balance outdoor pollution with indoor cooking, damp and occupancy sources.`,
    sources: [SOURCES.cpcb, SOURCES.cams],
  }

  const commute: Recommendation = {
    id: 'commute-lower-exposure',
    title: 'Choose the lower-exposure commute',
    category: 'commute',
    action: commuteAdvice,
    suggestedTime: `Departure around ${best?.start ?? 'a lower-forecast window'}`,
    explanation:
      'Roadside concentrations can be higher than city-wide model values, and solo motorised trips add personal emissions. Public transport, carpooling and trip combining reduce both.',
    environmentalContext: `${context} Your saved commute is ${profile.commute}, ${profile.commuteDistanceKm} km one way.`,
    beneficiaries: beneficiariesFor(profile, ['Children']),
    cost: profile.commute === 'Metro' || profile.commute === 'Bus' ? 'Under ₹1,500' : 'Free',
    effort: 'Medium',
    benefitType: 'Lower personal transport emissions and roadside exposure',
    evidenceLevel: 'Likely',
    limitations: `${BASE_LIMITATION} Mode shift does not instantly change city-wide AQI. Safety, trip length and service availability still matter.`,
    sources: [SOURCES.who, SOURCES.cams],
  }

  const outdoor: Recommendation = {
    id: 'outdoor-activity',
    title: isVeryHigh ? 'Move exercise indoors' : isElevated ? 'Keep outdoor exercise light and short' : 'Use the cleaner outdoor window',
    category: 'outdoor',
    action: isVeryHigh
      ? 'Avoid strenuous outdoor exercise. Use an indoor activity and keep essential outdoor trips short.'
      : isElevated
        ? `If you exercise outdoors, choose ${bestLabel} and reduce intensity and duration. Children and sensitive adults should use indoor alternatives.`
        : `Outdoor activity is reasonable for most people; prefer ${bestLabel} and avoid busy roads.`,
    suggestedTime: bestLabel,
    explanation:
      'Breathing rate rises during exercise, so the same outdoor concentration can mean a larger exposure. Timing activity to a lower-forecast window reduces the exposure proxy.',
    environmentalContext: context,
    beneficiaries: [...householdBeneficiaries],
    cost: 'Free',
    effort: 'Low',
    benefitType: 'Lower exposure during physical activity',
    evidenceLevel: 'Likely',
    limitations: `${BASE_LIMITATION} This is exposure-time guidance, not an inhaled-dose or medical-risk calculation. Follow clinician advice for existing conditions.`,
    sources: [SOURCES.who, SOURCES.cams],
  }

  const school: Recommendation | null =
    profile.children > 0
      ? {
          id: 'school-protection',
          title: 'Plan the school commute around cleaner air',
          category: 'school',
          action: isSevere
            ? 'Keep outdoor school travel short, avoid strenuous games, and use a well-fitting particulate respirator for essential travel if local guidance allows. Do not rely on masks to replace exposure reduction.'
            : `Use the cleaner travel window ${bestLabel}, prefer a low-traffic route, and keep outdoor play flexible if conditions worsen.`,
          suggestedTime: bestLabel,
          explanation:
            'Children breathe more air relative to their body size and may spend more time outdoors at school. Route and timing choices can reduce exposure without disrupting school.',
          environmentalContext: context,
          beneficiaries: ['Children', 'School-going students'],
          cost: 'Free',
          effort: 'Low',
          benefitType: 'Lower school-travel and play exposure',
          evidenceLevel: 'Likely',
          limitations: `${BASE_LIMITATION} Mask fit matters; a loose mask provides little benefit. Follow school and local public-health instructions.`,
          sources: [SOURCES.who],
        }
      : null

  const indoor: Recommendation = {
    id: 'indoor-source-control',
    title: 'Control indoor sources first',
    category: 'indoor',
    action:
      profile.cookingFuel === 'Biomass or wood' || profile.cookingFuel === 'Mixed'
        ? 'Use the kitchen exhaust every time you cook. Avoid incense, indoor smoking and any unnecessary combustion; discuss cleaner cooking options where feasible.'
        : 'Run the kitchen exhaust during cooking, avoid incense and indoor smoking, and damp-dust or mop instead of dry sweeping.',
    suggestedTime: 'During cooking and cleaning',
    explanation:
      'Indoor combustion and resuspended dust can keep indoor particle levels high even when windows are closed. Source control is the first step before filtration.',
    environmentalContext: context,
    beneficiaries: [...householdBeneficiaries],
    cost: 'Free',
    effort: 'Low',
    benefitType: 'Lower indoor particle sources',
    evidenceLevel: 'Established',
    limitations: `${BASE_LIMITATION} Actual indoor concentrations depend on the home, cooking, occupancy and ventilation; no indoor sensor reading is assumed.`,
    sources: [SOURCES.who],
  }

  const elderly: Recommendation | null =
    profile.elderly > 0
      ? {
          id: 'elderly-precautions',
          title: 'Reduce exertion for older household members',
          category: 'elderly',
          action: isElevated
            ? 'Move errands and walks to the cleaner forecast window, keep essential medicines and care plans accessible, and seek medical advice if symptoms worsen.'
            : 'Normal activity is reasonable, but prefer quieter routes and the cleaner forecast window.',
          suggestedTime: bestLabel,
          explanation:
            'Older adults and people with heart or lung conditions can be more sensitive to particulate exposure. Reducing exertion during higher-pollution periods is a practical precaution.',
          environmentalContext: context,
          beneficiaries: ['Older adults', 'Sensitive adults'],
          cost: 'Free',
          effort: 'Low',
          benefitType: 'Lower exposure during routine activity',
          evidenceLevel: 'Established',
          limitations: `${BASE_LIMITATION} This does not replace medical advice or emergency care.`,
          sources: [SOURCES.who],
        }
      : null

  const filtration: Recommendation = {
    id: 'filtration',
    title: profile.hasPurifier ? 'Maintain appropriately sized filtration' : 'Size filtration to the room',
    category: 'night',
    action: purifierAdvice,
    suggestedTime: 'Evening and overnight',
    explanation: `A ${profile.roomAreaSqFt} sq ft room at a 9 ft ceiling is about ${cadr.volumeM3} m³. At ${cadr.achLow}–${cadr.achHigh} air changes per hour, the unit should deliver roughly ${cadr.cadrM3hLow}–${cadr.cadrM3hHigh} m³/h CADR.`,
    environmentalContext: context,
    beneficiaries: beneficiariesFor(profile, ['Outdoor worker']),
    cost: profile.hasPurifier ? 'Free' : indoorBudget,
    effort: profile.hasPurifier ? 'Low' : 'Medium',
    benefitType: 'Lower indoor particulate exposure when the unit is correctly sized and maintained',
    evidenceLevel: 'Established',
    limitations: `${BASE_LIMITATION} Filtration does not remove gases reliably unless the unit is designed for them. Never use ozone generators or unsafe DIY electrical devices.`,
    sources: [SOURCES.who],
  }

  const evening: Recommendation = {
    id: 'evening-ventilation',
    title: 'Recheck before evening ventilation',
    category: 'evening',
    action: eveningAction,
    suggestedTime: bestLabel,
    explanation:
      'Evening conditions can change quickly. Using the hourly forecast avoids the common mistake of assuming every evening is cleaner.',
    environmentalContext: context,
    beneficiaries: [...householdBeneficiaries],
    cost: 'Free',
    effort: 'Low',
    benefitType: 'Avoid unnecessary outdoor particle ingress',
    evidenceLevel: 'Likely',
    limitations: `${BASE_LIMITATION} If indoor cooking or damp sources are high, brief targeted ventilation may still be appropriate.`,
    sources: [SOURCES.cams, SOURCES.who],
  }

  const outdoorWorker: Recommendation | null = profile.outdoorWorker
    ? {
        id: 'outdoor-worker',
        title: 'Schedule outdoor work breaks',
        category: 'outdoor',
        action: isElevated
          ? `Shift strenuous tasks away from ${worstLabel}, take breaks in a cleaner indoor area, and discuss exposure controls with your employer.`
          : `Use the cleaner window ${bestLabel} for strenuous tasks and keep water and breaks available.`,
        suggestedTime: bestLabel,
        explanation:
          'Outdoor workers cannot always choose their hours. Task rotation, breaks and indoor rest areas can still reduce the exposure proxy.',
        environmentalContext: context,
        beneficiaries: ['Outdoor worker'],
        cost: 'Free',
        effort: 'Medium',
        benefitType: 'Lower occupational exposure',
        evidenceLevel: 'Likely',
        limitations: `${BASE_LIMITATION} Workplace safety duties and local labour guidance take precedence.`,
        sources: [SOURCES.who, SOURCES.cpcb],
      }
    : null

  // Reading order: the day, then household-specific additions in their place.
  const recommendations: Recommendation[] = [
    morning,
    commute,
    outdoor,
    ...(school ? [school] : []),
    indoor,
    ...(elderly ? [elderly] : []),
    filtration,
    evening,
    ...(outdoorWorker ? [outdoorWorker] : []),
  ]

  const categoryText = category ? CATEGORY_SUMMARY[category] : 'AQI is unavailable because of insufficient pollutant coverage.'
  const contextSummary = `${categoryText} ${context}`

  return {
    recommendations,
    bestWindow: best,
    worstWindow: worst,
    generatedAt: now.toISOString(),
    contextSummary,
  }
}

const CATEGORY_TITLES: Record<RecommendationCategory, string> = {
  morning: 'Morning routine',
  commute: 'Commute',
  outdoor: 'Outdoor activity',
  indoor: 'Indoor environment',
  school: 'School and children',
  elderly: 'Elderly precautions',
  evening: 'Evening routine',
  night: 'Night-time environment',
}

export function recommendationTitle(category: RecommendationCategory): string {
  return CATEGORY_TITLES[category]
}

export function localBriefFallback(input: PlanInput): AiBrief {
  const planner = buildPlanner(input)
  return {
    source: 'unavailable',
    greeting: null,
    sections: planner.recommendations.slice(0, 8).map(item => ({
      title: recommendationTitle(item.category),
      guidance: item.action,
    })),
    sources: [SOURCES.cams, SOURCES.cpcb],
    reason: 'AI brief is unavailable, so the deterministic guidance remains active.',
  }
}

import type { EvidenceLevel } from '../types'

export type AlternativeDomain = 'household' | 'community'

export interface SustainableAlternative {
  id: string
  domain: AlternativeDomain
  title: string
  currentBehaviour: string
  alternative: string
  /** Cost language is deliberately relative, not a fabricated rupee figure. */
  cost: string
  practicality: string
  environmentalBenefit: string
  /** Every non-transport alternative is qualitative: no invented tonnage. */
  estimatedAvoidedEmissions: string
  evidenceLevel: EvidenceLevel
  methodology: string
  limitations: string
  sources: string[]
}

const WHO = 'WHO global air quality guidelines (2021)'
const CPCB = 'CPCB National Air Quality Index methodology'
const HEALTH = 'Public-health guidance for high-pollution episodes'

/**
 * Household and community alternatives. These are qualitative by design:
 * there is no defensible per-household emission factor for incense, waste
 * burning or awareness campaigns, so no kilogram figure is invented.
 */
export const HOUSEHOLD_ALTERNATIVES: readonly SustainableAlternative[] = [
  {
    id: 'cleaner-cooking',
    domain: 'household',
    title: 'Shift cooking away from solid fuel',
    currentBehaviour: 'Biomass, wood or mixed fuel cooking, if that is your current setup.',
    alternative:
      'Where feasible, move to LPG, piped gas or electric induction. If solid fuel must be used, cook with the exhaust running and keep the kitchen door closed.',
    cost: 'LPG or electric cooking usually carries a higher running cost than collected wood; induction also needs suitable cookware and a reliable supply.',
    practicality: 'Depends on connection availability, upfront appliance cost and household cooking habits. Renters may need the owner’s consent.',
    environmentalBenefit: 'Removes a major indoor and neighbourhood source of fine particles and carbon monoxide.',
    estimatedAvoidedEmissions: 'Not estimated. A per-household figure would need measured fuel use, stove efficiency and local grid factors.',
    evidenceLevel: 'Established',
    methodology:
      'Qualitative comparison of combustion sources. Cooking with solid fuel is a recognised source of household air pollution; no emission total is claimed without measured fuel consumption.',
    limitations:
      'Cost and feasibility vary widely. Never remove or disable a cooking appliance without a safe alternative in place. Follow local safety rules for gas and electrical work.',
    sources: [WHO, HEALTH],
  },
  {
    id: 'no-waste-burning',
    domain: 'household',
    title: 'Stop burning household waste',
    currentBehaviour: 'Burning leaves, paper, plastic or mixed waste in the open or in a drum.',
    alternative: 'Segregate waste and use the municipal collection service. Compost suitable kitchen and garden waste instead of burning it.',
    cost: 'Usually free or low cost. Composting needs a bin and a little space.',
    practicality: 'Requires reliable collection or a local composting option.',
    environmentalBenefit: 'Avoids a concentrated source of fine particles, black carbon and toxic combustion products close to homes.',
    estimatedAvoidedEmissions: 'Not estimated. Open-burning emissions depend on waste composition and moisture, which the app cannot measure.',
    evidenceLevel: 'Established',
    methodology: 'Qualitative source-removal reasoning. Burning mixed waste produces hazardous combustion products; no mass estimate is presented.',
    limitations: 'Burning is sometimes used because collection is unreliable. Report persistent dumping or burning to the local municipal body rather than confronting neighbours directly.',
    sources: [WHO, HEALTH],
  },
  {
    id: 'efficient-appliances',
    domain: 'household',
    title: 'Choose efficient appliances and cut standby waste',
    currentBehaviour: 'Older, low-efficiency appliances left running or on standby.',
    alternative: 'When replacing an appliance, compare star ratings and running cost. Switch off unused devices and use timers where practical.',
    cost: 'Higher upfront cost for efficient models; lower running cost over time. Switching off standby is free.',
    practicality: 'Best planned around a replacement cycle rather than an emergency purchase.',
    environmentalBenefit: 'Lower electricity demand reduces the emissions associated with power generation, which varies with the local grid mix.',
    estimatedAvoidedEmissions: 'Not estimated in this app. A credible figure needs the appliance’s rated consumption and the local grid emission factor.',
    evidenceLevel: 'Likely',
    methodology: 'Qualitative efficiency reasoning. No kWh-to-CO₂e conversion is shown because the app does not know the local grid factor or actual usage.',
    limitations: 'Grid emission intensity differs by region and time of day. Efficiency gains do not directly reduce local particulate concentrations.',
    sources: [HEALTH],
  },
]

export const COMMUNITY_ALTERNATIVES: readonly SustainableAlternative[] = [
  {
    id: 'carpool-group',
    domain: 'community',
    title: 'Start a neighbourhood carpool group',
    currentBehaviour: 'Several households driving similar routes alone at similar times.',
    alternative: 'Agree a shared route and schedule with two or three neighbours. Rotate driving duties so the burden is shared.',
    cost: 'Usually saves fuel per person; may add a small amount of time.',
    practicality: 'Works best with fixed office or school timings and a simple coordination channel.',
    environmentalBenefit: 'Fewer vehicle trips for the same journeys, so lower per-person transport emissions and less roadside exposure.',
    estimatedAvoidedEmissions: 'Calculated in the Transport tab when you enter the distance, travel days and occupancy.',
    evidenceLevel: 'Likely',
    methodology: 'Per-passenger transport planning factors. The Transport tab shows the exact factors, version and uncertainty range used.',
    limitations: 'Does not change city-wide AQI immediately. Vehicle type, load and route still determine actual emissions.',
    sources: [HEALTH],
  },
  {
    id: 'public-transport-awareness',
    domain: 'community',
    title: 'Promote public transport and safe walking routes',
    currentBehaviour: 'Defaulting to private vehicles for short, routine trips.',
    alternative: 'Share metro and bus options, timings and safe walking or cycling routes with neighbours, schools or your workplace.',
    cost: 'Free to organise; public transport fares vary by city.',
    practicality: 'Needs basic route and safety information that is genuinely usable.',
    environmentalBenefit: 'Shifts short trips to higher-occupancy modes and reduces congestion-related emissions.',
    estimatedAvoidedEmissions: 'Not aggregated at community scale. Use the Transport tab for your own commute estimate.',
    evidenceLevel: 'Likely',
    methodology: 'Qualitative mode-shift reasoning. No community-wide tonnage is claimed because participation and trip lengths are unknown.',
    limitations: 'Safety, accessibility, service frequency and last-mile connectivity all affect adoption.',
    sources: [HEALTH],
  },
  {
    id: 'anti-burning-campaign',
    domain: 'community',
    title: 'Support local anti-burning and dust awareness',
    currentBehaviour: 'Seasonal leaf, waste and construction-dust burning going unchallenged.',
    alternative: 'Share municipal reporting channels, encourage covered construction material and support green-waste collection.',
    cost: 'Free to participate.',
    practicality: 'Depends on local municipal responsiveness and community trust.',
    environmentalBenefit: 'Reduces local combustion and dust sources that contribute to neighbourhood particulate levels.',
    estimatedAvoidedEmissions: 'Not estimated. Source strength is highly variable and not measured by this app.',
    evidenceLevel: 'Indicative',
    methodology: 'Qualitative source-reduction reasoning based on public-health guidance. No modelled AQI improvement is claimed.',
    limitations: 'Awareness work does not replace enforcement or structural waste collection. Avoid confrontational or unsafe approaches.',
    sources: [HEALTH, CPCB],
  },
  {
    id: 'waste-segregation',
    domain: 'community',
    title: 'Make waste segregation the default',
    currentBehaviour: 'Mixed waste that is harder to collect, recycle or compost.',
    alternative: 'Separate wet, dry and hazardous waste at home and encourage the same in your building or street.',
    cost: 'Free to low cost, with a little space for separate bins.',
    practicality: 'Works only if collection keeps streams separate.',
    environmentalBenefit: 'Reduces the pressure to burn or dump waste, which are direct particulate sources.',
    estimatedAvoidedEmissions: 'Not estimated. Depends on collection practice and what would otherwise happen to the waste.',
    evidenceLevel: 'Indicative',
    methodology: 'Qualitative waste-management reasoning. No emission factor is applied.',
    limitations: 'Segregation is only as good as the downstream collection and processing system.',
    sources: [HEALTH],
  },
]

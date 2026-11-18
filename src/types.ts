export type PollutantKey = 'pm25' | 'pm10' | 'no2' | 'so2' | 'co' | 'o3' | 'nh3'

export type AqiCategory = 'Good' | 'Satisfactory' | 'Moderate' | 'Poor' | 'Very Poor' | 'Severe'

export type DataSourceKind = 'model' | 'official'

export interface PollutantResult {
  key: PollutantKey
  label: string
  unit: string
  averagingPeriod: string
  value: number | null
  subIndex: number | null
  category: AqiCategory | null
  beyondScale: boolean
  source: DataSourceKind
}

export type AqiStatus = 'ok' | 'insufficient-coverage'

export interface AqiAssessment {
  aqi: number | null
  category: AqiCategory | null
  status: AqiStatus
  reason: string | null
  validPollutants: number
  requiredPollutants: number
  hasParticulate: boolean
  pollutants: PollutantResult[]
  beyondScale: boolean
}

export interface HourlyPoint {
  time: string
  label: string
  pm25: number | null
  aqi: number | null
  category: AqiCategory | null
}

export interface WeatherNow {
  temperatureC: number
  /** Null when the provider omits the field; never substituted with zero. */
  humidityPct: number | null
  /** Null when the provider omits the field; never substituted with zero. */
  windKmh: number | null
  weatherCode: number | null
  description: string
  observedAt: string | null
}

export interface PollutantValues {
  pm25: number | null
  pm10: number | null
  no2: number | null
  so2: number | null
  co: number | null
  o3: number | null
  nh3: number | null
}

export interface ModelSnapshot {
  assessment: AqiAssessment
  hourly: HourlyPoint[]
  provider: string
  model: string
  fetchedAt: string
  averagingNote: string
}

export interface OfficialSnapshot {
  available: boolean
  aqi: number | null
  category: AqiCategory | null
  station: string | null
  /** Distance to the reporting station when the provider supplies it. */
  distanceKm: number | null
  observedAt: string | null
  provider: string
  reason: string | null
}

export interface AirQualitySnapshot {
  model: ModelSnapshot
  official: OfficialSnapshot
  weather: WeatherNow | null
  fetchedAt: string
}

export interface AirQualityResult {
  data: AirQualitySnapshot | null
  loading: boolean
  refreshing: boolean
  error: string | null
  isStale: boolean
  lastUpdated: string | null
  refresh: () => void
}

export type CommuteMode = 'Metro' | 'Bus' | 'Carpool' | 'Petrol car' | 'Two-wheeler' | 'Walking or cycling'

export type BudgetBand =
  | 'Free'
  | 'Under ₹1,500'
  | '₹1,500–₹12,000'
  | 'Premium solutions'

export type WorkTiming = 'Early morning' | 'Daytime' | 'Evening' | 'Night' | 'Flexible'

export type ExerciseFrequency = 'Rarely' | '1–2 times a week' | '3–4 times a week' | 'Daily'

export type CookingFuel = 'LPG or piped gas' | 'Electric' | 'Biomass or wood' | 'Mixed'

export type VentilationQuality = 'Good cross-ventilation' | 'Single-side windows' | 'Poor or sealed'

export interface Profile {
  adults: number
  children: number
  elderly: number
  outdoorWorker: boolean
  respiratorySensitivity: boolean
  cardiovascularSensitivity: boolean
  commute: CommuteMode
  commuteDistanceKm: number
  workTiming: WorkTiming
  exerciseFrequency: ExerciseFrequency
  cookingFuel: CookingFuel
  ventilation: VentilationQuality
  hasPurifier: boolean
  roomAreaSqFt: number
  budget: BudgetBand
}

export interface Place {
  name: string
  admin1: string | null
  country: string | null
  latitude: number
  longitude: number
}

export interface LocationState {
  city: string
  latitude: number
  longitude: number
  label: 'search' | 'geolocation' | 'manual'
}

export type RecommendationCategory =
  | 'morning'
  | 'commute'
  | 'outdoor'
  | 'indoor'
  | 'school'
  | 'elderly'
  | 'evening'
  | 'night'

export type CostCategory = BudgetBand

export type EffortLevel = 'Low' | 'Medium' | 'High'

export type EvidenceLevel = 'Established' | 'Likely' | 'Indicative'

export interface Recommendation {
  id: string
  title: string
  category: RecommendationCategory
  action: string
  suggestedTime: string
  explanation: string
  environmentalContext: string
  beneficiaries: string[]
  cost: CostCategory
  effort: EffortLevel
  benefitType: string
  evidenceLevel: EvidenceLevel
  limitations: string
  sources: string[]
}

export interface PollutionWindow {
  start: string
  end: string
  averageAqi: number | null
  averagePm25: number | null
}

export interface PlannerResult {
  recommendations: Recommendation[]
  bestWindow: PollutionWindow | null
  worstWindow: PollutionWindow | null
  generatedAt: string
  contextSummary: string
}

export interface AiBriefSection {
  title: string
  guidance: string
}

export interface AiBrief {
  source: 'gemini' | 'unavailable'
  greeting: string | null
  sections: AiBriefSection[]
  sources: string[]
  reason: string | null
}

export interface ChatAnswer {
  answer: string
  sources: string[]
  source: 'gemini' | 'fallback'
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  sources?: string[]
  source?: 'gemini' | 'fallback'
}

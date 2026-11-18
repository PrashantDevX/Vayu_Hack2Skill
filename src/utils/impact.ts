import type { CommuteMode, HourlyPoint } from '../types'

export interface TransportFactor {
  label: string
  kgCo2ePerPassengerKm: number
  note: string
}

/**
 * Planning factors for passenger-kilometres. They are indicative and are not
 * measured vehicle emissions or an air-quality prediction. Version is surfaced
 * next to every calculated result.
 */
export const TRANSPORT_FACTOR_VERSION = 'vayu-planning-2026.1'
export const TRANSPORT_FACTOR_SOURCE =
  'Indicative planning factors derived from published per-passenger transport emission factors; metro is an order-of-magnitude estimate and varies with grid mix and occupancy.'

export const TRANSPORT_FACTORS: Record<CommuteMode, TransportFactor> = {
  Metro: {
    label: 'Metro',
    kgCo2ePerPassengerKm: 0.041,
    note: 'Electric rail estimate; varies with grid carbon intensity and occupancy.',
  },
  Bus: {
    label: 'Bus',
    kgCo2ePerPassengerKm: 0.089,
    note: 'Average urban bus occupancy assumed.',
  },
  Carpool: {
    label: 'Carpool',
    kgCo2ePerPassengerKm: 0.192,
    note: 'Petrol-car factor divided by the number of occupants entered.',
  },
  'Petrol car': {
    label: 'Petrol car',
    kgCo2ePerPassengerKm: 0.192,
    note: 'Single-occupant petrol car planning factor.',
  },
  'Two-wheeler': {
    label: 'Two-wheeler',
    kgCo2ePerPassengerKm: 0.103,
    note: 'Petrol two-wheeler planning factor.',
  },
  'Walking or cycling': {
    label: 'Walking or cycling',
    kgCo2ePerPassengerKm: 0,
    note: 'No direct tailpipe emissions; safety and trip length still matter.',
  },
}

export const TRANSPORT_UNCERTAINTY_PCT = 0.2

export interface TransportInput {
  oneWayKm: number
  daysPerWeek: number
  mode: CommuteMode
  occupancy?: number
}

export interface TransportEstimate {
  mode: CommuteMode
  factorKgPerPassengerKm: number
  occupancy: number
  weeklyKg: number
  monthlyKg: number
  annualKg: number
}

export interface TransportComparison {
  baseline: TransportEstimate
  alternative: TransportEstimate
  weeklySavingsKg: number
  monthlySavingsKg: number
  annualSavingsKg: number
  annualSavingsLowKg: number
  annualSavingsHighKg: number
  factorVersion: string
  factorSource: string
  assumptions: string[]
}

function assertNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative finite number`)
}

function roundKg(value: number): number {
  return Math.round(value * 100) / 100
}

export function estimateTransport(input: TransportInput): TransportEstimate {
  assertNonNegative('One-way distance', input.oneWayKm)
  assertNonNegative('Travel days', input.daysPerWeek)
  if (input.daysPerWeek > 7) throw new Error('Travel days cannot exceed 7')
  const occupancy = input.occupancy ?? 1
  if (!Number.isFinite(occupancy) || occupancy < 1) throw new Error('Occupancy must be at least 1')

  const factor = TRANSPORT_FACTORS[input.mode]
  const effectiveFactor = factor.kgCo2ePerPassengerKm / (input.mode === 'Carpool' ? occupancy : 1)
  const weeklyKg = input.oneWayKm * 2 * input.daysPerWeek * effectiveFactor

  return {
    mode: input.mode,
    factorKgPerPassengerKm: effectiveFactor,
    occupancy: input.mode === 'Carpool' ? occupancy : 1,
    weeklyKg: roundKg(weeklyKg),
    monthlyKg: roundKg((weeklyKg * 52) / 12),
    annualKg: roundKg(weeklyKg * 52),
  }
}

export function compareTransport(input: {
  oneWayKm: number
  daysPerWeek: number
  alternative: CommuteMode
  occupancy?: number
}): TransportComparison {
  const baseline = estimateTransport({
    oneWayKm: input.oneWayKm,
    daysPerWeek: input.daysPerWeek,
    mode: 'Petrol car',
  })
  const alternative = estimateTransport({
    oneWayKm: input.oneWayKm,
    daysPerWeek: input.daysPerWeek,
    mode: input.alternative,
    occupancy: input.occupancy,
  })
  const annualSavingsKg = Math.max(0, roundKg(baseline.annualKg - alternative.annualKg))
  const uncertainty = annualSavingsKg * TRANSPORT_UNCERTAINTY_PCT

  return {
    baseline,
    alternative,
    weeklySavingsKg: Math.max(0, roundKg(baseline.weeklyKg - alternative.weeklyKg)),
    monthlySavingsKg: Math.max(0, roundKg(baseline.monthlyKg - alternative.monthlyKg)),
    annualSavingsKg,
    annualSavingsLowKg: Math.max(0, roundKg(annualSavingsKg - uncertainty)),
    annualSavingsHighKg: roundKg(annualSavingsKg + uncertainty),
    factorVersion: TRANSPORT_FACTOR_VERSION,
    factorSource: TRANSPORT_FACTOR_SOURCE,
    assumptions: [
      'One round trip per travel day, 52 weeks per year.',
      'Factors are per passenger-kilometre; carpool divides the car factor by occupants.',
      'Saved emissions are personal transport emissions, not a city-scale AQI change.',
      'Actual emissions vary with vehicle, fuel, traffic, load and energy source.',
    ],
  }
}

/** Exposure proxy in µg/m³·h. This is not inhaled dose and not medical risk. */
export function exposureProxy(pm25: number | null, hours: number): number | null {
  if (pm25 === null || !Number.isFinite(pm25) || pm25 < 0) return null
  if (!Number.isFinite(hours) || hours < 0) throw new Error('Hours must be a non-negative finite number')
  return Math.round(pm25 * hours * 10) / 10
}

export function sumExposureProxy(points: HourlyPoint[], startIndex: number, hours: number): number | null {
  if (!Number.isFinite(hours) || hours <= 0) throw new Error('Hours must be a positive finite number')
  const selected = points.slice(startIndex, startIndex + Math.ceil(hours))
  if (selected.length === 0) return null
  let total = 0
  for (const point of selected) {
    if (point.pm25 === null || !Number.isFinite(point.pm25)) return null
    total += point.pm25
  }
  return Math.round(total * 10) / 10
}

export interface CadrEstimate {
  volumeFt3: number
  volumeM3: number
  cadrM3hLow: number
  cadrM3hHigh: number
  achLow: number
  achHigh: number
}

export function estimateCadr(input: {
  areaSqFt: number
  ceilingFt?: number
  achLow?: number
  achHigh?: number
}): CadrEstimate {
  assertNonNegative('Room area', input.areaSqFt)
  if (input.areaSqFt === 0) throw new Error('Room area must be greater than zero')
  const ceilingFt = input.ceilingFt ?? 9
  assertNonNegative('Ceiling height', ceilingFt)
  const achLow = input.achLow ?? 4
  const achHigh = input.achHigh ?? 5
  if (achLow <= 0 || achHigh < achLow) throw new Error('ACH targets are invalid')

  const volumeFt3 = input.areaSqFt * ceilingFt
  const volumeM3 = volumeFt3 * 0.0283168466

  return {
    volumeFt3: Math.round(volumeFt3),
    volumeM3: Math.round(volumeM3 * 10) / 10,
    cadrM3hLow: Math.round(volumeM3 * achLow),
    cadrM3hHigh: Math.round(volumeM3 * achHigh),
    achLow,
    achHigh,
  }
}

export function budgetRank(budget: string): number {
  switch (budget) {
    case 'Free':
      return 0
    case 'Under ₹1,500':
      return 1
    case '₹1,500–₹12,000':
      return 2
    case 'Premium solutions':
      return 3
    default:
      return 0
  }
}

/**
 * Annual round-trip CO2e kept for compatibility with the original project API.
 * Prefer compareTransport/estimateTransport for new UI code.
 */
export function estimateAnnualCo2e(distanceKm: number, days: number, factorKgPerKm: number): number {
  if ([distanceKm, days, factorKgPerKm].some(value => !Number.isFinite(value) || value < 0)) {
    throw new Error('Inputs must be non-negative finite numbers')
  }
  return distanceKm * 2 * days * 52 * factorKgPerKm
}

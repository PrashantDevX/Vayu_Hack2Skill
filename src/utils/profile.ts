import { z } from 'zod'
import { BUDGET_BANDS, COMMUTE_MODES, DEFAULT_PROFILE } from '../constants/aqi'
import type { Profile } from '../types'

const count = z.number().int().min(0).max(20)

export const profileSchema = z.object({
  adults: count,
  children: count,
  elderly: count,
  outdoorWorker: z.boolean(),
  respiratorySensitivity: z.boolean(),
  cardiovascularSensitivity: z.boolean(),
  commute: z.enum(COMMUTE_MODES as [Profile['commute'], ...Profile['commute'][]]),
  commuteDistanceKm: z.number().min(0).max(300),
  workTiming: z.enum(['Early morning', 'Daytime', 'Evening', 'Night', 'Flexible']),
  exerciseFrequency: z.enum(['Rarely', '1–2 times a week', '3–4 times a week', 'Daily']),
  cookingFuel: z.enum(['LPG or piped gas', 'Electric', 'Biomass or wood', 'Mixed']),
  ventilation: z.enum(['Good cross-ventilation', 'Single-side windows', 'Poor or sealed']),
  hasPurifier: z.boolean(),
  roomAreaSqFt: z.number().min(20).max(5000),
  budget: z.enum(BUDGET_BANDS as [Profile['budget'], ...Profile['budget'][]]),
})

export const locationSchema = z.object({
  city: z.string().trim().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  label: z.enum(['search', 'geolocation', 'manual']),
})

export function parseStoredProfile(raw: string | null): Profile | null {
  if (!raw) return null
  try {
    const parsed = profileSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function sanitizeProfile(input: Partial<Profile>): Profile {
  const merged = { ...DEFAULT_PROFILE, ...input }
  const parsed = profileSchema.safeParse(merged)
  return parsed.success ? parsed.data : DEFAULT_PROFILE
}

/** Persist coordinates only at ~1 km precision to avoid retaining exact GPS. */
export function quantizeCoordinate(value: number): number {
  return Math.round(value * 100) / 100
}

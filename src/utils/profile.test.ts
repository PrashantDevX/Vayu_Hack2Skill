import { describe, expect, it } from 'vitest'
import { DEFAULT_PROFILE } from '../constants/aqi'
import { parseStoredProfile, profileSchema, quantizeCoordinate, sanitizeProfile } from './profile'

describe('profile validation', () => {
  it('accepts the default profile', () => {
    expect(profileSchema.safeParse(DEFAULT_PROFILE).success).toBe(true)
  })

  it('rejects invalid counts and distances', () => {
    expect(profileSchema.safeParse({ ...DEFAULT_PROFILE, adults: -1 }).success).toBe(false)
    expect(profileSchema.safeParse({ ...DEFAULT_PROFILE, commuteDistanceKm: 400 }).success).toBe(false)
    expect(profileSchema.safeParse({ ...DEFAULT_PROFILE, roomAreaSqFt: 0 }).success).toBe(false)
    expect(profileSchema.safeParse({ ...DEFAULT_PROFILE, commute: 'Rocket' }).success).toBe(false)
  })

  it('parses only valid stored JSON and falls back safely', () => {
    expect(parseStoredProfile(JSON.stringify(DEFAULT_PROFILE))).toEqual(DEFAULT_PROFILE)
    expect(parseStoredProfile('{bad json')).toBeNull()
    expect(parseStoredProfile(JSON.stringify({ adults: 2 }))).toBeNull()
    expect(parseStoredProfile(null)).toBeNull()
  })

  it('sanitizes partial input without trusting it', () => {
    expect(sanitizeProfile({ adults: 3 })).toMatchObject({ adults: 3, commute: DEFAULT_PROFILE.commute })
    expect(sanitizeProfile({ adults: -4, budget: 'Rocket' as never })).toEqual(DEFAULT_PROFILE)
  })

  it('quantizes persisted coordinates', () => {
    expect(quantizeCoordinate(28.61394)).toBe(28.61)
    expect(quantizeCoordinate(77.20901)).toBe(77.21)
  })
})

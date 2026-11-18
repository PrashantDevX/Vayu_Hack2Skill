/* eslint-disable react/only-export-components */
import { createContext, useCallback, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { assessAqi } from '../utils/aqi'
import { localDateKey } from '../utils/date'
import { DEFAULT_PROFILE, POPULAR_CITIES } from '../constants/aqi'
import {
  locationSchema,
  parseStoredProfile,
  quantizeCoordinate,
} from '../utils/profile'
import type { AirQualityResult, LocationState, PlannerResult, Profile } from '../types'
import { buildPlanner } from '../services/recommendationService'
import { useLocalStorageState, useBooleanLocalStorage } from '../hooks/useLocalStorage'
import { useAirQuality } from '../hooks/useAirQuality'

export const STORAGE_KEYS = {
  profile: 'vayu.profile.v1',
  location: 'vayu.location.v1',
  checklist: 'vayu.checklist.v1',
  onboarded: 'vayu.onboarded.v1',
} as const

const EMPTY_ASSESSMENT = assessAqi({
  pm25: null,
  pm10: null,
  no2: null,
  so2: null,
  co: null,
  o3: null,
  nh3: null,
})

const DEFAULT_LOCATION: LocationState = {
  city: POPULAR_CITIES[0]?.city ?? 'New Delhi',
  latitude: POPULAR_CITIES[0]?.latitude ?? 28.6139,
  longitude: POPULAR_CITIES[0]?.longitude ?? 77.209,
  label: 'search',
}

function readLocation(raw: string | null): LocationState {
  if (!raw) return DEFAULT_LOCATION
  try {
    const parsed = locationSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : DEFAULT_LOCATION
  } catch {
    return DEFAULT_LOCATION
  }
}

function readChecklist(raw: string | null): Record<string, string[]> {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: Record<string, string[]> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
        result[key] = value
      }
    }
    return result
  } catch {
    return {}
  }
}

interface AppContextValue {
  profile: Profile
  updateProfile: (profile: Profile) => void
  resetProfile: () => void
  location: LocationState
  setLocation: (location: LocationState) => void
  air: AirQualityResult
  refresh: () => void
  planner: PlannerResult
  checklist: string[]
  toggleChecklistItem: (id: string) => void
  resetChecklist: () => void
  onboarded: boolean
  setOnboarded: (value: boolean) => void
  resetAllData: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useLocalStorageState<Profile>(STORAGE_KEYS.profile, raw =>
    parseStoredProfile(raw) ?? DEFAULT_PROFILE,
  )
  const [location, setLocationState] = useLocalStorageState<LocationState>(
    STORAGE_KEYS.location,
    readLocation,
  )
  const [checklists, setChecklists] = useLocalStorageState<Record<string, string[]>>(
    STORAGE_KEYS.checklist,
    readChecklist,
  )
  const [onboarded, setOnboarded] = useBooleanLocalStorage(STORAGE_KEYS.onboarded, false)
  const air = useAirQuality(location)
  const today = localDateKey()

  const setLocation = useCallback(
    (next: LocationState) => {
      setLocationState({
        ...next,
        city: next.city.trim().slice(0, 120),
        latitude: quantizeCoordinate(next.latitude),
        longitude: quantizeCoordinate(next.longitude),
      })
    },
    [setLocationState],
  )

  const planner = useMemo(
    () =>
      buildPlanner({
        assessment: air.data?.model.assessment ?? EMPTY_ASSESSMENT,
        hourly: air.data?.model.hourly ?? [],
        profile,
      }),
    [air.data, profile],
  )

  const checklist = useMemo(() => checklists[today] ?? [], [checklists, today])

  const toggleChecklistItem = useCallback(
    (id: string) => {
      setChecklists(previous => {
        const current = previous[today] ?? []
        return {
          ...previous,
          [today]: current.includes(id) ? current.filter(item => item !== id) : [...current, id],
        }
      })
    },
    [setChecklists, today],
  )

  const resetChecklist = useCallback(() => {
    setChecklists(previous => ({ ...previous, [today]: [] }))
  }, [setChecklists, today])

  const resetProfile = useCallback(() => {
    setProfile(DEFAULT_PROFILE)
    setOnboarded(false)
  }, [setProfile, setOnboarded])

  const resetAllData = useCallback(() => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => window.localStorage.removeItem(key))
    } catch {
      // Ignore storage failures.
    }
    setProfile(DEFAULT_PROFILE)
    setLocationState(DEFAULT_LOCATION)
    setChecklists({})
    setOnboarded(false)
  }, [setProfile, setLocationState, setChecklists, setOnboarded])

  const value = useMemo<AppContextValue>(
    () => ({
      profile,
      updateProfile: setProfile,
      resetProfile,
      location,
      setLocation,
      air,
      refresh: air.refresh,
      planner,
      checklist,
      toggleChecklistItem,
      resetChecklist,
      onboarded,
      setOnboarded,
      resetAllData,
    }),
    [
      profile,
      setProfile,
      resetProfile,
      location,
      setLocation,
      air,
      planner,
      checklist,
      toggleChecklistItem,
      resetChecklist,
      onboarded,
      setOnboarded,
      resetAllData,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}

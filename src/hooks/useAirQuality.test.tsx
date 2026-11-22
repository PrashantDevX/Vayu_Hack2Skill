import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AirQualitySnapshot, LocationState } from '../types'
import { useAirQuality } from './useAirQuality'

const { fetchAirQualityMock } = vi.hoisted(() => ({ fetchAirQualityMock: vi.fn() }))

vi.mock('../services/aqiService', () => ({ fetchAirQuality: fetchAirQualityMock }))

const firstLocation: LocationState = {
  city: 'New Delhi',
  latitude: 28.61,
  longitude: 77.21,
  label: 'search',
}

const secondLocation: LocationState = {
  city: 'Pune',
  latitude: 18.52,
  longitude: 73.86,
  label: 'search',
}

function snapshot(fetchedAt: string): AirQualitySnapshot {
  return {
    model: {
      assessment: {
        aqi: 120,
        category: 'Moderate',
        status: 'ok',
        reason: null,
        validPollutants: 3,
        requiredPollutants: 3,
        hasParticulate: true,
        pollutants: [],
        beyondScale: false,
      },
      hourly: [],
      provider: 'Open-Meteo Air Quality (CAMS model)',
      model: 'CAMS forecast',
      fetchedAt,
      averagingNote: 'Model estimate',
    },
    official: {
      available: false,
      aqi: null,
      category: null,
      station: null,
      distanceKm: null,
      observedAt: null,
      provider: 'data.gov.in',
      reason: 'Not configured',
      pollutants: [],
    },
    weather: null,
    fetchedAt,
  }
}

beforeEach(() => fetchAirQualityMock.mockReset())

describe('useAirQuality', () => {
  it('does not show the prior location reading when the new location fetch fails', async () => {
    fetchAirQualityMock.mockResolvedValueOnce(snapshot('2026-11-22T10:00:00.000Z'))
    const { result, rerender } = renderHook(
      ({ location }: { location: LocationState }) => useAirQuality(location),
      { initialProps: { location: firstLocation } },
    )

    await waitFor(() => expect(result.current.data?.model.assessment.aqi).toBe(120))
    expect(result.current.lastUpdated).toBe('2026-11-22T10:00:00.000Z')

    fetchAirQualityMock.mockRejectedValueOnce(new Error('provider unavailable'))
    rerender({ location: secondLocation })

    await waitFor(() => expect(result.current.error).toContain('No estimate is being substituted'))
    expect(result.current.data).toBeNull()
    expect(result.current.lastUpdated).toBeNull()
    expect(result.current.isStale).toBe(false)
    expect(result.current.loading).toBe(false)
  })

  it('keeps same-location data marked stale when a refresh fails', async () => {
    const lastKnown = snapshot('2026-11-22T10:00:00.000Z')
    fetchAirQualityMock.mockResolvedValueOnce(lastKnown)
    const { result } = renderHook(() => useAirQuality(firstLocation))

    await waitFor(() => expect(result.current.data).toBe(lastKnown))
    fetchAirQualityMock.mockRejectedValueOnce(new Error('provider unavailable'))

    act(() => result.current.refresh())

    await waitFor(() => expect(result.current.isStale).toBe(true))
    expect(result.current.data).toBe(lastKnown)
    expect(result.current.lastUpdated).toBe(lastKnown.model.fetchedAt)
    expect(result.current.error).toContain('last successfully retrieved data')
    expect(result.current.refreshing).toBe(false)
  })
})

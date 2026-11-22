import { useCallback, useEffect, useRef, useState } from 'react'
import type { AirQualityResult, AirQualitySnapshot, LocationState } from '../types'
import { fetchAirQuality } from '../services/aqiService'
import { coordinateKey } from '../services/cache'

const AUTO_REFRESH_MS = 15 * 60 * 1000

export function useAirQuality(location: LocationState): AirQualityResult {
  const [data, setData] = useState<AirQualitySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isStale, setIsStale] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [activeLocationKey, setActiveLocationKey] = useState<string | null>(null)
  const mounted = useRef(true)
  const requestId = useRef(0)
  const activeLocationKeyRef = useRef<string | null>(null)
  const dataRef = useRef<AirQualitySnapshot | null>(null)
  const locationKey = `${location.city.trim().toLowerCase()}:${coordinateKey(location.latitude, location.longitude)}`

  const load = useCallback(
    async (force: boolean) => {
      if (activeLocationKeyRef.current !== locationKey) {
        activeLocationKeyRef.current = locationKey
        setActiveLocationKey(locationKey)
        if (dataRef.current !== null) {
          dataRef.current = null
          setData(null)
          setLastUpdated(null)
          setIsStale(false)
        }
      }

      const id = requestId.current + 1
      requestId.current = id
      if (force) setRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const snapshot = await fetchAirQuality(location, { force })
        if (!mounted.current || requestId.current !== id) return
        dataRef.current = snapshot
        setData(snapshot)
        setLastUpdated(snapshot.model.fetchedAt)
        setIsStale(false)
      } catch {
        if (!mounted.current || requestId.current !== id) return
        if (dataRef.current !== null) {
          setIsStale(true)
          setError('Live refresh failed. Showing the last successfully retrieved data.')
        } else {
          setError('Air-quality data is unavailable right now. No estimate is being substituted.')
        }
      } finally {
        if (mounted.current && requestId.current === id) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [location, locationKey],
  )

  useEffect(() => {
    mounted.current = true
    // Fetching an external provider is the intended effect; the initial loading
    // state is already true, so this only starts the request.
    // eslint-disable-next-line react/set-state-in-effect
    void load(false)
    return () => {
      mounted.current = false
    }
  }, [load])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true)
    }, AUTO_REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [load])

  const refresh = useCallback(() => {
    void load(true)
  }, [load])

  const locationIsActive = activeLocationKey === locationKey
  return {
    data: locationIsActive ? data : null,
    loading: loading || !locationIsActive,
    refreshing: refreshing && locationIsActive,
    error: locationIsActive ? error : null,
    isStale: locationIsActive && isStale,
    lastUpdated: locationIsActive ? lastUpdated : null,
    refresh,
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AirQualityResult, AirQualitySnapshot, LocationState } from '../types'
import { fetchAirQuality } from '../services/aqiService'

const AUTO_REFRESH_MS = 15 * 60 * 1000

export function useAirQuality(location: LocationState): AirQualityResult {
  const [data, setData] = useState<AirQualitySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isStale, setIsStale] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const mounted = useRef(true)
  const requestId = useRef(0)

  const load = useCallback(
    async (force: boolean) => {
      const id = requestId.current + 1
      requestId.current = id
      if (force) setRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const snapshot = await fetchAirQuality(location, { force })
        if (!mounted.current || requestId.current !== id) return
        setData(snapshot)
        setLastUpdated(snapshot.model.fetchedAt)
        setIsStale(false)
      } catch {
        if (!mounted.current || requestId.current !== id) return
        setData(previous => {
          if (previous) {
            setIsStale(true)
            setError('Live refresh failed. Showing the last successfully retrieved data.')
          } else {
            setError('Air-quality data is unavailable right now. No estimate is being substituted.')
          }
          return previous
        })
      } finally {
        if (mounted.current && requestId.current === id) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [location],
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

  return { data, loading, refreshing, error, isStale, lastUpdated, refresh }
}

import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, LocateFixed, MapPin, Search } from 'lucide-react'
import { POPULAR_CITIES } from '../constants/aqi'
import { searchCities } from '../services/geocodingService'
import type { LocationState, Place } from '../types'

interface LocationSearchProps {
  onSelect: (location: LocationState) => void
  compact?: boolean
}

export function LocationSearch({ onSelect, compact = false }: LocationSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')

  const runSearch = async (event?: FormEvent) => {
    event?.preventDefault()
    if (query.trim().length < 2) {
      setMessage('Enter at least two characters to search.')
      return
    }
    setSearching(true)
    setMessage(null)
    try {
      const places = await searchCities(query)
      setResults(places)
      if (places.length === 0) setMessage('No matching place was found. Try a nearby city or enter coordinates.')
    } catch {
      setMessage('City search is unavailable. You can pick a popular city or enter coordinates manually.')
    } finally {
      setSearching(false)
    }
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage('Your browser does not support geolocation. Search for a city instead.')
      return
    }
    setMessage('Requesting permission…')
    navigator.geolocation.getCurrentPosition(
      position => {
        onSelect({
          city: 'My approximate location',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: 'geolocation',
        })
        setMessage(null)
      },
      error => {
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. City search still works.'
            : 'Your location could not be determined. Search for a city instead.',
        )
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    )
  }

  const submitManual = (event: FormEvent) => {
    event.preventDefault()
    const lat = Number(latitude)
    const lon = Number(longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setMessage('Enter a latitude between -90 and 90 and a longitude between -180 and 180.')
      return
    }
    onSelect({ city: 'Custom coordinates', latitude: lat, longitude: lon, label: 'manual' })
  }

  return (
    <div className={compact ? 'location-search compact' : 'location-search'}>
      <form className="search-box" onSubmit={runSearch} role="search">
        <Search size={18} aria-hidden="true" />
        <label className="sr-only" htmlFor="city-search">Search for a city</label>
        <input
          id="city-search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search city, district or postcode"
          autoComplete="off"
          maxLength={80}
        />
        <button type="submit" disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
      </form>

      {message && <p className="form-message" role="status">{message}</p>}

      {results.length > 0 && (
        <ul className="place-results" aria-label="Search results">
          {results.map(place => (
            <li key={`${place.latitude}-${place.longitude}-${place.name}`}>
              <button
                type="button"
                onClick={() =>
                  onSelect({
                    city: place.name,
                    latitude: place.latitude,
                    longitude: place.longitude,
                    label: 'search',
                  })
                }
              >
                <MapPin size={16} aria-hidden="true" />
                <span>
                  <strong>{place.name}</strong>
                  <small>{[place.admin1, place.country].filter(Boolean).join(', ')}</small>
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="location-actions">
        <button type="button" className="locate-button" onClick={useCurrentLocation}>
          <LocateFixed size={18} aria-hidden="true" /> Use my current location
        </button>
        <button type="button" className="text-link" onClick={() => setManualOpen(open => !open)}>
          Enter coordinates manually
        </button>
      </div>

      {manualOpen && (
        <form className="manual-form" onSubmit={submitManual}>
          <label>
            Latitude
            <input value={latitude} onChange={event => setLatitude(event.target.value)} inputMode="decimal" placeholder="28.61" />
          </label>
          <label>
            Longitude
            <input value={longitude} onChange={event => setLongitude(event.target.value)} inputMode="decimal" placeholder="77.21" />
          </label>
          <button type="submit" className="secondary-button">Use coordinates</button>
        </form>
      )}

      <div className="recent-cities">
        <small>Popular cities</small>
        {POPULAR_CITIES.map(place => (
          <button
            key={place.city}
            type="button"
            onClick={() =>
              onSelect({
                city: place.city,
                latitude: place.latitude,
                longitude: place.longitude,
                label: 'search',
              })
            }
          >
            <MapPin size={16} aria-hidden="true" />
            {place.city}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database, MapPin, ShieldCheck, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { ProfileForm } from '../components/ProfileForm'
import { LocationDialog } from '../components/LocationDialog'
import { profileSchema } from '../utils/profile'
import type { Profile } from '../types'

export default function Settings() {
  const {
    profile,
    updateProfile,
    resetProfile,
    location,
    setLocation,
    air,
    resetAllData,
    setOnboarded,
  } = useApp()
  const [draft, setDraft] = useState<Profile>(profile)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locationOpen, setLocationOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const navigate = useNavigate()
  const official = air.data?.official

  const save = () => {
    const parsed = profileSchema.safeParse(draft)
    if (!parsed.success) {
      setError('Check the household counts, commute distance and room area before saving.')
      return
    }
    updateProfile(parsed.data)
    setError(null)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  }

  const clear = () => {
    resetAllData()
    setConfirmReset(false)
    navigate('/')
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PREFERENCES &amp; PRIVACY</p>
          <h1>Settings</h1>
          <p>Edit your household profile, location and locally stored data.</p>
        </div>
      </div>

      <div className="settings-layout">
        <section className="settings-card" aria-labelledby="location-settings">
          <div className="card-heading">
            <div>
              <small>LOCATION</small>
              <h2 id="location-settings">{location.city}</h2>
            </div>
            <MapPin size={20} aria-hidden="true" />
          </div>
          <p className="data-note">
            Saved coordinates are rounded to about 1 km precision. Browser geolocation is permission-based and exact
            GPS values are not retained.
          </p>
          <button type="button" className="secondary-button" onClick={() => setLocationOpen(true)}>
            Change location
          </button>
        </section>

        <section className="settings-card" aria-labelledby="data-settings">
          <div className="card-heading">
            <div>
              <small>DATA SOURCES</small>
              <h2 id="data-settings">Provider status</h2>
            </div>
            <Database size={20} aria-hidden="true" />
          </div>
          <dl className="status-list">
            <div><dt>Model provider</dt><dd>Open-Meteo CAMS</dd></div>
            <div>
              <dt>Official CPCB resource</dt>
              <dd>
                {official?.available
                  ? official.aqi !== null
                    ? 'Configured — official AQI received'
                    : 'Configured — official station concentrations (resource has no AQI field)'
                  : official?.reason ?? 'Not configured'}
              </dd>
            </div>
            <div><dt>Last successful fetch</dt><dd>{air.data?.model.fetchedAt ? new Date(air.data.model.fetchedAt).toLocaleString() : 'Unavailable'}</dd></div>
          </dl>
          <p className="data-note">
            Environment secrets are server-side only. This page never displays API keys or provider credentials.
          </p>
        </section>
      </div>

      <section className="settings-card" aria-labelledby="profile-settings">
        <div className="card-heading">
          <div>
            <small>HOUSEHOLD PROFILE</small>
            <h2 id="profile-settings">Personalization details</h2>
          </div>
          <button type="button" className="secondary-button" onClick={() => setOnboarded(false)}>
            Restart onboarding
          </button>
        </div>
        <ProfileForm value={draft} onChange={setDraft} idPrefix="settings" />
        {error && <p className="form-message error" role="alert">{error}</p>}
        <div className="profile-actions">
          <button type="button" className="secondary-button" onClick={() => setDraft(profile)}>Discard changes</button>
          <button type="button" className="primary-button" onClick={save}>{saved ? 'Saved' : 'Save profile'}</button>
        </div>
      </section>

      <section className="settings-card privacy-card" aria-labelledby="privacy-heading">
        <div className="card-heading">
          <div>
            <small>PRIVACY</small>
            <h2 id="privacy-heading">Your data stays on this device</h2>
          </div>
          <ShieldCheck size={20} aria-hidden="true" />
        </div>
        <p>
          Vayu stores household preference categories, a rounded location and daily checklist state in this browser’s
          local storage. It does not collect names, exact birth dates, diagnoses, medical records or exact GPS
          coordinates. Only non-identifying preference categories are sent to the AI service.
        </p>
        <p>
          You can delete the profile and reset the app below. Clearing browser storage for this site has the same
          effect. The AI assistant and official-data features require server-side environment configuration; the rest
          of the app works without them.
        </p>
        <div className="profile-actions">
          <button type="button" className="secondary-button" onClick={resetProfile}>Reset profile only</button>
          {!confirmReset ? (
            <button type="button" className="secondary-button danger" onClick={() => setConfirmReset(true)}>
              <Trash2 size={16} aria-hidden="true" /> Delete all local data
            </button>
          ) : (
            <span className="confirm-actions">
              <button type="button" className="secondary-button" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button type="button" className="primary-button danger" onClick={clear}>Confirm delete</button>
            </span>
          )}
        </div>
      </section>

      <p className="page-footnote">
        Vayu is a public-health planning aid, not a medical device. Model estimates are labeled separately from
        official observations, and no missing reading is replaced with demo data.
      </p>

      <LocationDialog open={locationOpen} onClose={() => setLocationOpen(false)} onSelect={setLocation} />
    </div>
  )
}

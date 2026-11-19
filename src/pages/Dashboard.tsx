import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bike,
  Check,
  CheckCircle2,
  Clock3,
  CloudSun,
  Info,
  Leaf,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sun,
  TrendingDown,
  Wind,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { AqiBadge } from '../components/AqiBadge'
import { ProvenanceNote } from '../components/DataProvenance'
import { greetingForHour } from '../utils/date'
import { dominantPollutant, formatPollutantValue } from '../utils/aqi'

function priorityHeadline(aqi: number | null | undefined): string {
  if (aqi === null || aqi === undefined) return 'Reduce unnecessary exposure until provider data is confirmed'
  if (aqi > 400) return 'Stay indoors where you can and keep outdoor trips to essentials'
  if (aqi > 300) return 'Avoid outdoor exertion and keep outdoor time very short'
  if (aqi > 200) return 'Keep essential outdoor time short'
  if (aqi > 100) return 'Plan outdoor activity around the cleaner forecast window'
  return 'Conditions are relatively clean — a good day to be outdoors'
}

function ChecklistItem({ id }: { id: string }) {
  const { planner, checklist, toggleChecklistItem } = useApp()
  const item = planner.recommendations.find(recommendation => recommendation.id === id)
  if (!item) return null
  const checked = checklist.includes(item.id)
  return (
    <button
      type="button"
      className={`task-card ${checked ? 'completed' : ''}`}
      onClick={() => toggleChecklistItem(item.id)}
      aria-pressed={checked}
    >
      <span className="task-check" aria-hidden="true">{checked ? <Check size={16} /> : null}</span>
      <span>
        <span className="task-time">{item.suggestedTime}</span>
        <strong>{item.title}</strong>
        <span className="task-copy">{item.action}</span>
      </span>
    </button>
  )
}

export default function Dashboard() {
  const { air, planner, location, profile, checklist, refresh } = useApp()
  const [now] = useState(() => new Date())
  const assessment = air.data?.model.assessment
  const weather = air.data?.weather
  const dominant = assessment ? dominantPollutant(assessment) : null
  const topActions = ['morning-windows', 'commute-lower-exposure', 'indoor-source-control']
  const completedActions = topActions.filter(id => checklist.includes(id)).length

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">TODAY · {now.toLocaleDateString(undefined, { day: 'numeric', month: 'long' }).toUpperCase()}</p>
          <h1>{greetingForHour(now.getHours())}</h1>
          <p>Here is what matters for your household in {location.city} today.</p>
        </div>
        <button type="button" className="secondary-button" onClick={refresh} disabled={air.refreshing}>
          <RefreshCw size={16} className={air.refreshing ? 'spin' : ''} aria-hidden="true" />
          {air.refreshing ? 'Refreshing…' : 'Refresh data'}
        </button>
      </div>

      {air.error && (
        <div className="status-banner warning" role="alert">
          <Info size={20} aria-hidden="true" />
          <div>
            <strong>{air.isStale ? 'Showing the last successful data' : 'Live data unavailable'}</strong>
            <p>{air.error}</p>
          </div>
          <button type="button" className="text-link" onClick={refresh}>Try again</button>
        </div>
      )}

      {air.loading && !air.data ? (
        <div className="loading-grid" aria-live="polite">
          <p>Retrieving model air-quality and weather data for {location.city}…</p>
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      ) : (
        <>
          <section className="dashboard-focus" aria-label="Today's priority summary">
            <div className="dashboard-focus-main">
              <span className="focus-icon"><ShieldCheck size={22} aria-hidden="true" /></span>
              <div>
                <small>TODAY&apos;S PRIORITY</small>
                <h2>{priorityHeadline(assessment?.aqi)}</h2>
                <p>
                  <MapPin size={13} aria-hidden="true" /> {location.city}
                  <span aria-hidden="true">·</span>
                  {assessment?.category ?? 'Coverage insufficient'}
                </p>
              </div>
              <Link className="focus-action" to="/planner">Open today&apos;s plan <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
            <div className="dashboard-focus-stats">
              <div>
                <span className="focus-stat-icon"><Wind size={16} aria-hidden="true" /></span>
                <span><small>ESTIMATED AQI</small><strong>{assessment?.aqi ?? 'Unavailable'}</strong></span>
              </div>
              <div>
                <span className="focus-stat-icon"><Clock3 size={16} aria-hidden="true" /></span>
                <span><small>CLEANER WINDOW</small><strong>{planner.bestWindow ? planner.bestWindow.start : 'Unavailable'}</strong></span>
              </div>
              <div>
                <span className="focus-stat-icon"><CheckCircle2 size={16} aria-hidden="true" /></span>
                <span><small>TODAY&apos;S ACTIONS</small><strong>{completedActions} / {topActions.length}</strong></span>
              </div>
            </div>
          </section>

          <div className="overview-grid">
            <section className="aqi-card" aria-labelledby="dashboard-aqi">
              <div className="card-heading">
                <div>
                  <small>ESTIMATED CPCB-STYLE MODEL AQI</small>
                  <h2 id="dashboard-aqi">{location.city}</h2>
                </div>
                <AqiBadge aqi={assessment?.aqi ?? null} category={assessment?.category ?? null} />
              </div>

              <div className="aqi-main">
                <div>
                  <strong>{assessment?.aqi ?? '—'}</strong>
                  <span>{assessment?.aqi === null || assessment?.aqi === undefined ? 'No overall index' : 'Estimated index'}</span>
                </div>
                <div className="aqi-gauge" aria-hidden="true">
                  <div style={{ '--progress': `${Math.min((assessment?.aqi ?? 0) / 500 * 100, 100)}%` } as React.CSSProperties} />
                </div>
              </div>

              <div className="pollutant-row">
                {(['pm25', 'pm10', 'no2'] as const).map(key => {
                  const item = assessment?.pollutants.find(pollutant => pollutant.key === key)
                  return (
                    <div key={key}>
                      <small>{item?.label ?? key.toUpperCase()}</small>
                      <strong>{formatPollutantValue(item?.value ?? null, key)}</strong>
                      <span>{item?.unit ?? 'µg/m³'}</span>
                    </div>
                  )
                })}
              </div>

              <Link className="text-link" to="/air-quality">
                View full air quality <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <p className="data-note">
                {dominant ? `${dominant.label} is the highest valid sub-index. ` : ''}
                Model estimate from Open-Meteo CAMS, not an official CPCB station reading. Coverage:{' '}
                {assessment?.validPollutants ?? 0}/{assessment?.pollutants.length ?? 7} pollutants.
              </p>
            </section>

            <section className="weather-card" aria-labelledby="weather-heading">
              <div className="card-heading">
                <div>
                  <small>WEATHER &amp; FORECAST</small>
                  <h2 id="weather-heading">Now</h2>
                </div>
                <CloudSun size={22} aria-hidden="true" />
              </div>
              {weather ? (
                <>
                  <div className="weather-main">
                    <div>
                      <strong>{weather.temperatureC.toFixed(0)}°</strong>
                      <span>{weather.description}</span>
                    </div>
                    <Sun className="weather-sun" aria-hidden="true" />
                  </div>
                  <div className="weather-stats">
                    <div>
                      <small>Humidity</small>
                      <strong>{weather.humidityPct === null ? 'Unavailable' : `${weather.humidityPct.toFixed(0)}%`}</strong>
                    </div>
                    <div>
                      <small>Wind</small>
                      <strong>{weather.windKmh === null ? 'Unavailable' : `${weather.windKmh.toFixed(0)} km/h`}</strong>
                    </div>
                  </div>
                </>
              ) : (
                <p className="empty-copy">Weather data is unavailable. Air-quality guidance is still shown.</p>
              )}
              <div className="best-window">
                <TrendingDown size={18} aria-hidden="true" />
                <div>
                  <small>Relatively cleaner window</small>
                  <strong>
                    {planner.bestWindow
                      ? `${planner.bestWindow.start}–${planner.bestWindow.end} · estimated AQI ${planner.bestWindow.averageAqi ?? 'unavailable'}`
                      : 'Unavailable from current forecast'}
                  </strong>
                </div>
              </div>
            </section>
          </div>

          <div className="section-heading">
            <div>
              <p className="eyebrow">PERSONALIZED FOR YOUR HOUSEHOLD</p>
              <h2>Today&apos;s protection plan</h2>
            </div>
            <Link className="text-link" to="/planner">View all actions <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>

          <div className="task-grid">
            {topActions.map(id => <ChecklistItem key={id} id={id} />)}
          </div>

          <div className="insights-grid">
            <section className="insight-card">
              <div className="insight-icon green"><Bike size={20} aria-hidden="true" /></div>
              <div>
                <small>LOW-EMISSION CHOICE</small>
                <h3>{profile.commute === 'Metro' || profile.commute === 'Bus' ? 'Keep using public transport' : 'Try a lower-emission commute'}</h3>
                <p>{profile.commute === 'Metro' || profile.commute === 'Bus'
                  ? `Your saved ${profile.commute.toLowerCase()} commute already avoids solo-car emissions. Combine errands where practical.`
                  : `Switching some ${profile.commute.toLowerCase()} trips to metro, bus or carpool can reduce personal transport emissions.`}</p>
                <Link className="text-link" to="/impact">Model the difference <ArrowRight size={14} aria-hidden="true" /></Link>
              </div>
            </section>
            <section className="insight-card">
              <div className="insight-icon amber"><Wind size={20} aria-hidden="true" /></div>
              <div>
                <small>INDOOR AIR</small>
                <h3>{profile.hasPurifier ? 'Maintain your filtration setup' : 'Source control comes first'}</h3>
                <p>{profile.hasPurifier
                  ? 'Check the purifier CADR against your room and replace filters on schedule.'
                  : 'Damp dusting, kitchen exhaust and avoiding indoor combustion are free first steps before buying a purifier.'}</p>
                <Link className="text-link" to="/indoor">Open indoor optimizer <ArrowRight size={14} aria-hidden="true" /></Link>
              </div>
            </section>
          </div>

          {air.data && (
            <ProvenanceNote
              provider={air.data.model.provider}
              model={air.data.model.model}
              fetchedAt={air.data.model.fetchedAt}
              stale={air.isStale}
              averagingNote={air.data.model.averagingNote}
            />
          )}

          <p className="page-footnote">
            <Leaf size={14} aria-hidden="true" /> Vayu separates model estimates from official observations and never
            fills missing readings with demo data.
          </p>
        </>
      )}
    </div>
  )
}

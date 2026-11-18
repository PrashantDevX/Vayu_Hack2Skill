import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bike,
  Check,
  CloudSun,
  Info,
  Leaf,
  RefreshCw,
  ShieldCheck,
  Sun,
  TrendingDown,
  Wind,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { AqiBadge } from '../components/AqiBadge'
import { ProvenanceNote } from '../components/DataProvenance'
import { CATEGORY_SUMMARY } from '../constants/aqi'
import { greetingForHour } from '../utils/date'
import { dominantPollutant, formatPollutantValue } from '../utils/aqi'

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
  const { air, planner, location, profile, refresh } = useApp()
  const [now] = useState(() => new Date())
  const assessment = air.data?.model.assessment
  const official = air.data?.official
  const weather = air.data?.weather
  const dominant = assessment ? dominantPollutant(assessment) : null
  const topActions = ['morning-windows', 'commute-lower-exposure', 'indoor-source-control']

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
          <div className={`status-banner ${assessment?.aqi && assessment.aqi > 200 ? 'warning' : ''}`}>
            <div className="status-icon">
              <ShieldCheck size={22} aria-hidden="true" />
            </div>
            <div>
              <strong>{assessment?.category ? CATEGORY_SUMMARY[assessment.category] : 'AQI cannot be shown from the available pollutant coverage.'}</strong>
              <p>
                {assessment?.aqi === null || assessment?.aqi === undefined
                  ? assessment?.reason ?? 'No overall index is inferred when the provider data is incomplete.'
                  : planner.bestWindow
                    ? `Relatively cleaner forecast window: ${planner.bestWindow.start}–${planner.bestWindow.end} (estimated AQI ${planner.bestWindow.averageAqi ?? 'unavailable'}).`
                    : 'No reliable hourly comparison window is available yet.'}
              </p>
            </div>
            <span className="status-source">{official?.available ? 'Official data available' : 'Model estimate only'}</span>
          </div>

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

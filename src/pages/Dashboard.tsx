import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bike,
  Check,
  CloudSun,
  Info,
  Leaf,
  MapPin,
  ShieldCheck,
  Sun,
  TrendingDown,
  Wind,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { AqiBadge } from '../components/AqiBadge'
import { AqiGauge } from '../components/AqiGauge'
import { DayTimeline } from '../components/DayTimeline'
import { KeyReadings } from '../components/KeyReadings'
import { PageHeading } from '../components/PageHeading'
import { ProvenanceNote } from '../components/DataProvenance'
import { RefreshButton } from '../components/RefreshButton'
import { greetingForHour } from '../utils/date'
import { categoryBand, dominantPollutant, formatPollutantValue } from '../utils/aqi'

function priorityHeadline(aqi: number | null | undefined): string {
  if (aqi === null || aqi === undefined) return 'Reduce unnecessary exposure until provider data is confirmed'
  if (aqi > 400) return 'Stay indoors where you can and keep outdoor trips to essentials'
  if (aqi > 300) return 'Avoid outdoor exertion and keep outdoor time very short'
  if (aqi > 200) return 'Keep essential outdoor time short'
  if (aqi > 100) return 'Plan outdoor activity around the cleaner forecast window'
  return 'Conditions are relatively clean — a good day to be outdoors'
}

/**
 * One sentence that explains the headline using only values the app actually
 * holds. No number is invented: with no assessment the sentence says so.
 */
function priorityReason(
  aqi: number | null | undefined,
  category: string | null | undefined,
  bestWindow: { start: string; end: string } | null,
): string {
  if (aqi === null || aqi === undefined) {
    return 'The live model feed is not returning a usable reading, so Vayu is not showing a number. The guidance below stays generic until data returns.'
  }
  const window = bestWindow ? ` Air is forecast to be lowest between ${bestWindow.start} and ${bestWindow.end}.` : ''
  return `Estimated AQI ${aqi}${category ? ` (${category})` : ''}.${window}`
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
  const band = categoryBand(assessment?.category)

  return (
    <div className="page">
      <PageHeading
        eyebrow={`TODAY · ${now.toLocaleDateString(undefined, { day: 'numeric', month: 'long' }).toUpperCase()}`}
        title={greetingForHour(now.getHours())}
        description={`Here is what matters for your household in ${location.city} today.`}
        action={<RefreshButton onClick={refresh} refreshing={air.refreshing} />}
      />

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
          {/* 1. THE ANSWER: what to do, stated once, larger than anything else. */}
          <section className={`dashboard-hero band-${band}`} aria-labelledby="priority-headline">
            <div className="hero-copy">
              <p className="eyebrow">
                <MapPin size={12} aria-hidden="true" /> RIGHT NOW IN {location.city.toUpperCase()}
              </p>
              <h2 id="priority-headline">{priorityHeadline(assessment?.aqi)}</h2>
              <p className="hero-reason">
                {priorityReason(assessment?.aqi, assessment?.category, planner.bestWindow)}
              </p>
              <KeyReadings
                label="Key readings"
                items={[
                  { label: 'Estimated AQI', value: assessment?.aqi ?? 'Unavailable' },
                  { label: 'Category', value: assessment?.category ?? 'Insufficient coverage' },
                  {
                    label: 'Cleaner window',
                    value: planner.bestWindow
                      ? `${planner.bestWindow.start}–${planner.bestWindow.end}`
                      : 'Unavailable',
                  },
                ]}
              /><div className="hero-actions">
                <Link className="primary-button" to="/planner">
                  Open today&apos;s plan <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link className="secondary-button" to="/advisor">
                  Ask Vayu a question
                </Link>
              </div>
            </div>
            <div className="hero-progress">
              <span className="hero-progress-icon"><ShieldCheck size={20} aria-hidden="true" /></span>
              <small>TODAY&apos;S ACTIONS</small>
              <strong>{completedActions} / {topActions.length}</strong>
              <div className="hero-progress-track" aria-hidden="true">
                <span style={{ width: `${(completedActions / topActions.length) * 100}%` }} />
              </div>
              <p>{completedActions === topActions.length ? 'All three done for today.' : 'Tick them off as you go.'}</p>
            </div>
          </section>

          {/* 2. WHEN: the day's three decision points. */}
          <DayTimeline assessment={assessment ?? null} best={planner.bestWindow} worst={planner.worstWindow} />

          {/* 3. DO: the actions themselves. */}
          <div className="section-heading">
            <div>
              <p className="eyebrow">PERSONALIZED FOR YOUR HOUSEHOLD</p>
              <h2>Do these three things today</h2>
            </div>
            <Link className="text-link" to="/planner">View all actions <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>

          <div className="task-grid">
            {topActions.map(id => <ChecklistItem key={id} id={id} />)}
          </div>

          {/* 4. WHY IT MATTERS for this household. */}
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

          {/* 5. THE NUMBERS: detail for people who want it, below the decision. */}
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE NUMBERS BEHIND THE ADVICE</p>
              <h2>Air quality and weather</h2>
            </div>
            <Link className="text-link" to="/air-quality">Full breakdown <ArrowRight size={15} aria-hidden="true" /></Link>
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
                <AqiGauge aqi={assessment?.aqi ?? null} />
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

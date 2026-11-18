import { Link } from 'react-router-dom'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { AqiBadge } from '../components/AqiBadge'
import { OfficialCard, ProvenanceNote } from '../components/DataProvenance'
import { formatPollutantValue } from '../utils/aqi'
import { formatObservedAt } from '../utils/date'

export default function AirQuality() {
  const { air, location, refresh, planner } = useApp()
  const assessment = air.data?.model.assessment
  const chartData = (air.data?.model.hourly ?? []).map(point => ({
    label: point.label,
    pm25: point.pm25,
    aqi: point.aqi,
  }))

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DATA &amp; PROVENANCE</p>
          <h1>Air quality</h1>
          <p>Model estimates and official observations for {location.city}, shown separately.</p>
        </div>
        <button type="button" className="secondary-button" onClick={refresh} disabled={air.refreshing}>
          <RefreshCw size={16} className={air.refreshing ? 'spin' : ''} aria-hidden="true" />
          {air.refreshing ? 'Refreshing…' : 'Refresh data'}
        </button>
      </div>

      {!air.data && air.loading && <p className="loading-copy" role="status">Retrieving provider data…</p>}
      {!air.data && !air.loading && (
        <div className="empty-state" role="alert">
          <h2>Air-quality data is unavailable</h2>
          <p>{air.error ?? 'The provider did not return usable data.'} No estimate is substituted.</p>
          <button type="button" className="primary-button" onClick={refresh}>Try again</button>
        </div>
      )}

      {air.data && assessment && (
        <>
          <ProvenanceNote
            provider={air.data.model.provider}
            model={air.data.model.model}
            fetchedAt={air.data.model.fetchedAt}
            stale={air.isStale}
            averagingNote={air.data.model.averagingNote}
          />

          <div className="air-layout">
            <section className="aqi-card large" aria-labelledby="model-aqi-heading">
              <div className="card-heading">
                <div>
                  <small>ESTIMATED CPCB-STYLE MODEL AQI</small>
                  <h2 id="model-aqi-heading">{location.city}</h2>
                </div>
                <AqiBadge aqi={assessment.aqi} category={assessment.category} />
              </div>
              <div className="aqi-main">
                <div>
                  <strong>{assessment.aqi ?? '—'}</strong>
                  <span>{assessment.aqi === null ? 'No overall index' : 'Estimated index'}</span>
                </div>
                <div className="aqi-gauge" aria-hidden="true">
                  <div style={{ '--progress': `${Math.min((assessment.aqi ?? 0) / 500 * 100, 100)}%` } as React.CSSProperties} />
                </div>
              </div>
              <p className="data-time">
                Provider update: {formatObservedAt(air.data.model.fetchedAt)} ·{' '}
                {assessment.validPollutants}/{assessment.pollutants.length} pollutants valid
              </p>
              {assessment.status === 'insufficient-coverage' && (
                <p className="coverage-note" role="note">{assessment.reason}</p>
              )}
              {assessment.beyondScale && (
                <p className="coverage-note" role="note">
                  At least one concentration is beyond the published CPCB sub-index scale and is capped at 500.
                </p>
              )}
              <p className="data-note">
                This is a model-derived estimate using CPCB breakpoints and the maximum valid sub-index. It is not an
                official CPCB AQI: provider values are instantaneous model fields, not official 24-hour/8-hour
                averages, and no station observation is implied.
              </p>
            </section>

            <section className="pollutants-card" aria-labelledby="pollutant-heading">
              <div className="card-heading">
                <div>
                  <small>MODEL CONCENTRATIONS</small>
                  <h2 id="pollutant-heading">Pollutants &amp; sub-indices</h2>
                </div>
              </div>
              <div className="pollutant-table-wrap">
                <table className="pollutant-table">
                  <caption className="sr-only">Model pollutant concentrations, CPCB sub-indices and averaging periods</caption>
                  <thead>
                    <tr>
                      <th scope="col">Pollutant</th>
                      <th scope="col">Value</th>
                      <th scope="col">Sub-index</th>
                      <th scope="col">CPCB averaging period</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessment.pollutants.map(pollutant => (
                      <tr key={pollutant.key}>
                        <th scope="row">{pollutant.label}</th>
                        <td>
                          {formatPollutantValue(pollutant.value, pollutant.key)} {pollutant.value !== null && pollutant.unit}
                        </td>
                        <td>{pollutant.subIndex ?? 'Unavailable'}</td>
                        <td>{pollutant.averagingPeriod}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="air-layout secondary">
            <OfficialCard official={air.data.official} />
            <section className="forecast-summary" aria-labelledby="window-heading">
              <div className="card-heading">
                <div>
                  <small>FORECAST WINDOWS</small>
                  <h2 id="window-heading">When conditions are relatively better</h2>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Relatively cleaner</dt>
                  <dd>{planner.bestWindow ? `${planner.bestWindow.start}–${planner.bestWindow.end} · estimated AQI ${planner.bestWindow.averageAqi ?? 'unavailable'}` : 'Unavailable'}</dd>
                </div>
                <div>
                  <dt>Higher pollution</dt>
                  <dd>{planner.worstWindow ? `${planner.worstWindow.start}–${planner.worstWindow.end} · estimated AQI ${planner.worstWindow.averageAqi ?? 'unavailable'}` : 'Unavailable'}</dd>
                </div>
              </dl>
              <p className="data-note">
                Windows use the next 24 hourly model values. They are not a claim that every morning or evening is
                cleaner; actual conditions can change.
              </p>
              <Link className="text-link" to="/planner">Build the daily plan <ArrowLeft size={15} aria-hidden="true" /></Link>
            </section>
          </div>

          <section className="chart-card" aria-labelledby="chart-heading">
            <div className="card-heading">
              <div>
                <small>24-HOUR MODEL FORECAST</small>
                <h2 id="chart-heading">Pollution and estimated AQI trend</h2>
              </div>
              <div className="legend"><span className="pm25-dot" /> PM2.5 <span className="aqi-dot" /> Estimated AQI</div>
            </div>
            {chartData.length > 0 ? (
              <>
                <div className="chart-wrap" aria-hidden="true">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: -12 }}>
                      <defs>
                        <linearGradient id="pmFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#5d8a73" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#5d8a73" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0ec" />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#7c837d' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="pm" tick={{ fontSize: 12, fill: '#7c837d' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="aqi" orientation="right" domain={[0, 500]} tick={{ fontSize: 12, fill: '#7c837d' }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Legend />
                      <Area yAxisId="pm" type="monotone" dataKey="pm25" name="PM2.5 (µg/m³)" stroke="#557b67" strokeWidth={2} fill="url(#pmFill)" connectNulls={false} />
                      <Line yAxisId="aqi" type="monotone" dataKey="aqi" name="Estimated AQI" stroke="#b07048" strokeWidth={2} dot={false} connectNulls={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <details className="data-table">
                  <summary>View the hourly data as a table</summary>
                  <table>
                    <caption>Next 24 hours of model PM2.5 and estimated CPCB-style AQI</caption>
                    <thead>
                      <tr><th scope="col">Time</th><th scope="col">PM2.5 (µg/m³)</th><th scope="col">Estimated AQI</th></tr>
                    </thead>
                    <tbody>
                      {chartData.map(point => (
                        <tr key={point.label}>
                          <th scope="row">{point.label}</th>
                          <td>{point.pm25 ?? 'Unavailable'}</td>
                          <td>{point.aqi ?? 'Unavailable'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </>
            ) : (
              <p className="empty-copy">No hourly forecast is available from the provider.</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}

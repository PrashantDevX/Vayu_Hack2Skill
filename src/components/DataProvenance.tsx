import { AlertTriangle, CloudSun, Database, ShieldCheck } from 'lucide-react'
import type { OfficialSnapshot } from '../types'
import { formatObservedAt, formatRelativeTime } from '../utils/date'

interface ProvenanceNoteProps {
  provider: string
  model: string
  fetchedAt: string
  stale: boolean
  averagingNote: string
}

export function ProvenanceNote({ provider, model, fetchedAt, stale, averagingNote }: ProvenanceNoteProps) {
  return (
    <div className={`provider-note ${stale ? 'stale' : ''}`} role="note">
      {stale ? <AlertTriangle size={17} /> : <Database size={17} />}
      <span>
        <strong>{stale ? 'Stale data:' : 'Data source:'}</strong> {provider}. {model}.{' '}
        {stale ? 'The last refresh failed; values may be out of date.' : `Updated ${formatRelativeTime(fetchedAt)}.`}{' '}
        {averagingNote}
      </span>
    </div>
  )
}

function formatConcentration(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function OfficialCard({ official }: { official: OfficialSnapshot }) {
  const hasAqi = official.available && official.aqi !== null
  const hasPollutants = official.available && official.pollutants.length > 0
  const heading = hasAqi
    ? 'Official station reading'
    : hasPollutants
      ? 'Official station concentrations'
      : 'Official data unavailable'

  return (
    <section className="official-card" aria-labelledby="official-heading">
      <div className="card-heading">
        <div>
          <small>OFFICIAL / THIRD-PARTY OBSERVATION</small>
          <h2 id="official-heading">{heading}</h2>
        </div>
        {official.available ? <ShieldCheck size={20} /> : <CloudSun size={20} />}
      </div>

      {hasAqi && (
        <div className="official-main">
          <strong>{official.aqi}</strong>
          <span>{official.category ?? 'Unclassified'}</span>
        </div>
      )}

      {official.available ? (
        <>
          {hasPollutants && (
            <>
              <table className="official-pollutants">
                <caption>Concentrations published by the official provider</caption>
                <thead>
                  <tr>
                    <th scope="col">Pollutant</th>
                    <th scope="col">Average</th>
                    <th scope="col">Reported range</th>
                  </tr>
                </thead>
                <tbody>
                  {official.pollutants.map(item => (
                    <tr key={item.id}>
                      <th scope="row">{item.label}</th>
                      <td>
                        {formatConcentration(item.value)} {item.unit}
                      </td>
                      <td>
                        {item.min !== null && item.max !== null
                          ? `${formatConcentration(item.min)}–${formatConcentration(item.max)} ${item.unit}`
                          : 'Not reported'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!hasAqi && (
                <p className="data-note">
                  This resource publishes station concentrations but not the CPCB AQI. Vayu reproduces the values
                  exactly as published and does not derive an official AQI from them; the index elsewhere in the app
                  is the model estimate. Particulates and gases are shown in µg/m³, the CPCB reporting convention.
                  CO is shown “as published” because this dataset does not state its unit. Averaging periods and
                  quality control are set by the provider, not by Vayu.
                </p>
              )}
            </>
          )}

          <dl className="official-meta">
            <div><dt>Station</dt><dd>{official.station ?? 'Not reported'}</dd></div>
            {official.distanceKm !== null && (
              <div><dt>Distance</dt><dd>~{official.distanceKm} km</dd></div>
            )}
            <div><dt>Observed</dt><dd>{formatObservedAt(official.observedAt)}</dd></div>
            <div><dt>Provider</dt><dd>{official.provider}</dd></div>
          </dl>
        </>
      ) : (
        <p className="empty-copy">
          {official.reason ?? 'No official observation is configured for this location.'} Vayu will never label a
          model estimate as an official CPCB reading.
        </p>
      )}
    </section>
  )
}

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

export function OfficialCard({ official }: { official: OfficialSnapshot }) {
  return (
    <section className="official-card" aria-labelledby="official-heading">
      <div className="card-heading">
        <div>
          <small>OFFICIAL / THIRD-PARTY OBSERVATION</small>
          <h2 id="official-heading">{official.available ? 'Official station reading' : 'Official data unavailable'}</h2>
        </div>
        {official.available ? <ShieldCheck size={20} /> : <CloudSun size={20} />}
      </div>
      {official.available ? (
        <>
          <div className="official-main">
            <strong>{official.aqi}</strong>
            <span>{official.category ?? 'Unclassified'}</span>
          </div>
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

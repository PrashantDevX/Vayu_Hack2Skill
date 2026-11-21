import { Link } from 'react-router-dom'
import { Info } from 'lucide-react'
import type { CadrEstimate } from '../../utils/impact'
import type { Profile } from '../../types'

interface IndoorPanelProps {
  profile: Profile
  cadr: CadrEstimate
}

export function IndoorPanel({ profile, cadr }: IndoorPanelProps) {
  return (
    <div className="simulator-layout" role="tabpanel" id="panel-indoor" aria-labelledby="tab-indoor">
      <section className="sim-controls" aria-labelledby="indoor-controls">
        <div className="card-heading">
          <div>
            <small>INDOOR SCENARIO</small>
            <h2 id="indoor-controls">Compare interventions</h2>
          </div>
        </div>
        <p className="data-note">
          Room: {profile.roomAreaSqFt} sq ft at a 9 ft ceiling ({cadr.volumeM3} m³). Target{' '}
          {cadr.achLow}–{cadr.achHigh} air changes/hour requires {cadr.cadrM3hLow}–{cadr.cadrM3hHigh} m³/h CADR.
        </p>
        <p className="data-note">
          No exact indoor PM2.5 reduction is claimed without an indoor sensor or validated model. The comparison
          is qualitative and cost-based.
        </p>
        <Link className="text-link" to="/indoor">Open the room configurator</Link>
      </section>
      <section className="sim-results" aria-labelledby="indoor-results">
        <div className="comparison-table">
          <div>
            <strong>Source control</strong>
            <span>Free</span>
            <p>Damp cleaning, kitchen exhaust, avoiding indoor combustion. Addresses particles at the source and is the first step.</p>
          </div>
          <div>
            <strong>HEPA filtration</strong>
            <span>{profile.budget}</span>
            <p>A certified unit near the breathing zone with a rated CADR of {cadr.cadrM3hLow}–{cadr.cadrM3hHigh} m³/h and maintained filters. Effectiveness depends on sizing, leakage and filter condition.</p>
          </div>
          <div>
            <strong>Ventilation</strong>
            <span>Free</span>
            <p>Useful only when outdoor levels are lower than the indoor source load. Check the hourly forecast before opening windows.</p>
          </div>
        </div>
        <div className="method-note">
          <Info size={16} aria-hidden="true" />
          <p>
            Method: CADR = room volume (m³) × target air changes per hour. This is a sizing calculation, not a
            prediction of indoor concentration. Ozone generators and unsafe DIY devices are never recommended.
          </p>
        </div>
      </section>
    </div>
  )
}

import { Info } from 'lucide-react'

interface ExposurePanelProps {
  hours: number
  currentPm25: number | null
  alternativePm25: number | null
  baselineProxy: number | null
  alternativeProxy: number | null
  proxyChange: number | null
  windowProxy: number | null
  cleanerWindow: string | null
  onHoursChange: (value: number) => void
}

export function ExposurePanel({
  hours,
  currentPm25,
  alternativePm25,
  baselineProxy,
  alternativeProxy,
  proxyChange,
  windowProxy,
  cleanerWindow,
  onHoursChange,
}: ExposurePanelProps) {
  return (
    <div className="simulator-layout" role="tabpanel" id="panel-exposure" aria-labelledby="tab-exposure">
      <section className="sim-controls" aria-labelledby="exposure-controls">
        <div className="card-heading">
          <div>
            <small>OUTDOOR SCENARIO</small>
            <h2 id="exposure-controls">Shift activity time</h2>
          </div>
        </div>
        <label htmlFor="exposure-hours">
          Time outdoors: <strong>{hours} hr</strong>
          <input id="exposure-hours" type="range" min={1} max={6} value={hours} onChange={event => onHoursChange(Number(event.target.value))} />
        </label>
        <p className="data-note">
          Baseline uses the next hourly model value. Alternative uses the relatively cleaner forecast window from
          the daily planner: {cleanerWindow ?? 'unavailable'}.
        </p>
        <p className="data-note">
          The output is an exposure-time proxy (PM2.5 × hours), not inhaled dose, medical risk or a guaranteed
          health benefit.
        </p>
      </section>

      <section className="sim-results" aria-labelledby="exposure-results">
        <div className="sim-savings">
          <small>EXPOSURE PROXY CHANGE</small>
          <strong>{proxyChange === null ? 'Unavailable' : `${proxyChange > 0 ? '+' : ''}${proxyChange}%`}</strong>
          <span>
            {baselineProxy === null || alternativeProxy === null
              ? 'Hourly PM2.5 is incomplete for this comparison.'
              : `${baselineProxy} → ${alternativeProxy} µg/m³·h over ${hours} hour${hours === 1 ? '' : 's'}`}
          </span>
        </div>
        <div className="savings-grid">
          <div><small>Baseline PM2.5</small><strong>{currentPm25 ?? 'Unavailable'} µg/m³</strong></div>
          <div><small>Alternative PM2.5</small><strong>{alternativePm25 ?? 'Unavailable'} µg/m³</strong></div>
          <div><small>Window proxy</small><strong>{windowProxy === null ? 'Unavailable' : `${windowProxy} µg/m³·h`}</strong></div>
        </div>
        <div className="method-note">
          <Info size={16} aria-hidden="true" />
          <p>
            Method: PM2.5 concentration × hours outdoors, using model forecast values. It ignores breathing rate,
            indoor/outdoor differences, indoor exposure and respiratory protection. It is not a medical risk score.
          </p>
        </div>
      </section>
    </div>
  )
}

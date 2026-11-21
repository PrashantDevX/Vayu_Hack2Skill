import { Info } from 'lucide-react'
import { COMMUTE_MODES } from '../../constants/aqi'
import { TRANSPORT_FACTORS, TRANSPORT_FACTOR_VERSION } from '../../utils/impact'
import type { TransportComparison } from '../../utils/impact'
import type { CommuteMode } from '../../types'

interface TransportPanelProps {
  distance: number
  days: number
  alternative: CommuteMode
  occupancy: number
  comparison: { value: TransportComparison | null; error: string | null }
  onDistanceChange: (value: number) => void
  onDaysChange: (value: number) => void
  onAlternativeChange: (mode: CommuteMode) => void
  onOccupancyChange: (value: number) => void
}

export function TransportPanel({
  distance,
  days,
  alternative,
  occupancy,
  comparison,
  onDistanceChange,
  onDaysChange,
  onAlternativeChange,
  onOccupancyChange,
}: TransportPanelProps) {
  const value = comparison.value
  return (
    <div className="simulator-layout" role="tabpanel" id="panel-transport" aria-labelledby="tab-transport">
      <section className="sim-controls" aria-labelledby="transport-controls">
        <div className="card-heading">
          <div>
            <small>COMMUTE SCENARIO</small>
            <h2 id="transport-controls">Compare transport</h2>
          </div>
        </div>
        <label htmlFor="sim-distance">
          One-way distance: <strong>{distance} km</strong>
          <input id="sim-distance" type="range" min={1} max={80} value={distance} onChange={event => onDistanceChange(Number(event.target.value))} />
        </label>
        <label htmlFor="sim-days">
          Travel days each week: <strong>{days} days</strong>
          <input id="sim-days" type="range" min={1} max={7} value={days} onChange={event => onDaysChange(Number(event.target.value))} />
        </label>
        <label htmlFor="sim-alternative">
          Alternative mode
          <select id="sim-alternative" value={alternative} onChange={event => onAlternativeChange(event.target.value as CommuteMode)}>
            {COMMUTE_MODES.map(mode => <option key={mode}>{mode}</option>)}
          </select>
        </label>
        {alternative === 'Carpool' && (
          <label htmlFor="sim-occupancy">
            Carpool occupants: <strong>{occupancy}</strong>
            <input id="sim-occupancy" type="range" min={2} max={5} value={occupancy} onChange={event => onOccupancyChange(Number(event.target.value))} />
          </label>
        )}
        <p className="data-note">
          Baseline is a single-occupant petrol car. The factors are planning estimates, not measurements of your
          vehicle.
        </p>
      </section>

      <section className="sim-results" aria-labelledby="transport-results" aria-describedby={comparison.error ? 'transport-error' : undefined}>
        <div className="sim-savings">
          <small>ESTIMATED ANNUAL CO₂e SAVING</small>
          {value ? (
            <>
              <strong>{value.annualSavingsKg.toFixed(0)} kg</strong>
              <span>
                Range {value.annualSavingsLowKg.toFixed(0)}–{value.annualSavingsHighKg.toFixed(0)} kg
                (±20% planning uncertainty)
              </span>
            </>
          ) : (
            <strong>Unavailable</strong>
          )}
        </div>

        {value && (
          <>
            <div className="comparison-bars">
              <div>
                <span>{value.baseline.mode}</span>
                <div><i style={{ width: '100%' }} /></div>
                <strong>{value.baseline.annualKg.toFixed(0)} kg/yr</strong>
              </div>
              <div>
                <span>{alternative}</span>
                <div>
                  <i style={{ width: `${Math.max(4, (value.alternative.annualKg / Math.max(1, value.baseline.annualKg)) * 100)}%` }} />
                </div>
                <strong>{value.alternative.annualKg.toFixed(0)} kg/yr</strong>
              </div>
            </div>

            <div className="savings-grid">
              <div><small>Weekly saving</small><strong>{value.weeklySavingsKg.toFixed(2)} kg</strong></div>
              <div><small>Monthly saving</small><strong>{value.monthlySavingsKg.toFixed(1)} kg</strong></div>
              <div><small>Annual saving</small><strong>{value.annualSavingsKg.toFixed(1)} kg</strong></div>
            </div>

            <div className="method-note">
              <Info size={16} aria-hidden="true" />
              <div>
                <p><strong>Method ({TRANSPORT_FACTOR_VERSION}):</strong> one-way distance × 2 × travel days × 52 × kg CO₂e per passenger-km. Carpool divides the car factor by occupants.</p>
                <p><strong>Assumptions:</strong> {value.assumptions.join(' ')}</p>
                <p><strong>Factor source:</strong> {value.factorSource}</p>
                <p><strong>What this does not show:</strong> {TRANSPORT_FACTORS[alternative].note} Personal emissions avoided do not demonstrate an immediate city AQI change.</p>
              </div>
            </div>
          </>
        )}
        {comparison.error && <p className="form-message error" id="transport-error" role="alert">{comparison.error}</p>}
      </section>
    </div>
  )
}

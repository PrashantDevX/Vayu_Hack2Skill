import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Info, Leaf, TrendingDown, Users } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { COMMUTE_MODES } from '../constants/aqi'
import { COMMUNITY_ALTERNATIVES, HOUSEHOLD_ALTERNATIVES } from '../constants/alternatives'
import { compareTransport, estimateCadr, exposureProxy, sumExposureProxy, TRANSPORT_FACTORS, TRANSPORT_FACTOR_VERSION } from '../utils/impact'
import type { CommuteMode } from '../types'

type Tab = 'transport' | 'exposure' | 'indoor' | 'alternatives'

const TAB_ORDER: readonly Tab[] = ['transport', 'exposure', 'indoor', 'alternatives']

const MODE_NOTES: Record<CommuteMode, { cost: string; practicality: string; benefit: string }> = {
  Metro: {
    cost: 'Fare per trip is usually lower than the running cost of a solo car trip, but depends on distance and city fares.',
    practicality: 'Needs a station within a reasonable walk or feeder ride, and works best when the route matches your trip.',
    benefit: 'High occupancy and electric traction usually mean far lower per-passenger emissions than a solo car.',
  },
  Bus: {
    cost: 'Among the cheapest motorised options per trip; verify current city fares.',
    practicality: 'Depends on route coverage, frequency and peak-hour crowding.',
    benefit: 'Higher occupancy spreads emissions across many passengers.',
  },
  Carpool: {
    cost: 'Shared fuel and parking cost; the more occupants, the lower the cost per person.',
    practicality: 'Works best with matching routes and fixed timings.',
    benefit: 'Fewer vehicles for the same trips, so lower per-person emissions.',
  },
  'Petrol car': {
    cost: 'Highest running cost per passenger when driving alone.',
    practicality: 'Convenient, but contributes the largest share of personal transport emissions among the motorised options here.',
    benefit: 'Useful only as a comparison baseline unless occupancy increases.',
  },
  'Two-wheeler': {
    cost: 'Lower fuel cost per trip than a car, but higher exposure to roadside pollution.',
    practicality: 'Widely used and flexible; weather and safety are real constraints.',
    benefit: 'Lower fuel use than a solo car, though per-passenger emissions are still substantial.',
  },
  'Walking or cycling': {
    cost: 'Free apart from equipment and maintenance.',
    practicality: 'Best for short trips on safe, low-traffic routes; not practical in extreme heat or heavy pollution.',
    benefit: 'No direct tailpipe emissions, and short trips replace the least efficient car journeys.',
  },
}

export default function ImpactSimulator() {
  const { profile, air, planner } = useApp()
  const [tab, setTab] = useState<Tab>('transport')
  const [distance, setDistance] = useState(profile.commuteDistanceKm || 10)
  const [days, setDays] = useState(5)
  const [alternative, setAlternative] = useState<CommuteMode>(
    profile.commute === 'Petrol car' ? 'Metro' : profile.commute,
  )
  const [occupancy, setOccupancy] = useState(2)
  const [hours, setHours] = useState(2)

  const comparison = useMemo(() => {
    try {
      return {
        value: compareTransport({ oneWayKm: distance, daysPerWeek: days, alternative, occupancy }),
        error: null,
      }
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : 'Invalid inputs' }
    }
  }, [distance, days, alternative, occupancy])

  const hourly = air.data?.model.hourly ?? []
  const bestIndex = planner.bestWindow ? Math.max(0, hourly.findIndex(point => point.label === planner.bestWindow?.start)) : 0
  const currentPm25 = hourly[0]?.pm25 ?? null
  const alternativePm25 = hourly[bestIndex]?.pm25 ?? null
  const baselineProxy = exposureProxy(currentPm25, hours)
  const alternativeProxy = exposureProxy(alternativePm25, hours)
  const proxyChange =
    baselineProxy !== null && alternativeProxy !== null && baselineProxy > 0
      ? Math.round(((alternativeProxy - baselineProxy) / baselineProxy) * 100)
      : null
  const windowProxy = sumExposureProxy(hourly, bestIndex, hours)
  const cadr = estimateCadr({ areaSqFt: profile.roomAreaSqFt, achLow: 4, achHigh: profile.children > 0 || profile.elderly > 0 ? 6 : 5 })

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">WHAT-IF ANALYSIS</p>
          <h1>Impact simulator</h1>
          <p>Compare personal emissions and exposure proxies before changing a routine.</p>
        </div>
      </div>

      <div
        className="sim-tabs"
        role="tablist"
        aria-label="Impact scenarios"
        onKeyDown={event => {
          const index = TAB_ORDER.indexOf(tab)
          if (index === -1) return
          let next: Tab | null = null
          if (event.key === 'ArrowRight') next = TAB_ORDER[(index + 1) % TAB_ORDER.length] ?? null
          if (event.key === 'ArrowLeft') next = TAB_ORDER[(index - 1 + TAB_ORDER.length) % TAB_ORDER.length] ?? null
          if (event.key === 'Home') next = TAB_ORDER[0] ?? null
          if (event.key === 'End') next = TAB_ORDER[TAB_ORDER.length - 1] ?? null
          if (next === null) return
          event.preventDefault()
          setTab(next)
          document.getElementById(`tab-${next}`)?.focus()
        }}
      >
        {([
          ['transport', 'Transport'],
          ['exposure', 'Outdoor exposure'],
          ['indoor', 'Indoor improvements'],
          ['alternatives', 'Sustainable alternatives'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'transport' && (
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
              <input id="sim-distance" type="range" min={1} max={80} value={distance} onChange={event => setDistance(Number(event.target.value))} />
            </label>
            <label htmlFor="sim-days">
              Travel days each week: <strong>{days} days</strong>
              <input id="sim-days" type="range" min={1} max={7} value={days} onChange={event => setDays(Number(event.target.value))} />
            </label>
            <label htmlFor="sim-alternative">
              Alternative mode
              <select id="sim-alternative" value={alternative} onChange={event => setAlternative(event.target.value as CommuteMode)}>
                {COMMUTE_MODES.map(mode => <option key={mode}>{mode}</option>)}
              </select>
            </label>
            {alternative === 'Carpool' && (
              <label htmlFor="sim-occupancy">
                Carpool occupants: <strong>{occupancy}</strong>
                <input id="sim-occupancy" type="range" min={2} max={5} value={occupancy} onChange={event => setOccupancy(Number(event.target.value))} />
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
              {comparison.value ? (
                <>
                  <strong>{comparison.value.annualSavingsKg.toFixed(0)} kg</strong>
                  <span>
                    Range {comparison.value.annualSavingsLowKg.toFixed(0)}–{comparison.value.annualSavingsHighKg.toFixed(0)} kg
                    (±20% planning uncertainty)
                  </span>
                </>
              ) : (
                <strong>Unavailable</strong>
              )}
            </div>

            {comparison.value && (
              <>
                <div className="comparison-bars">
                  <div>
                    <span>{comparison.value.baseline.mode}</span>
                    <div><i style={{ width: '100%' }} /></div>
                    <strong>{comparison.value.baseline.annualKg.toFixed(0)} kg/yr</strong>
                  </div>
                  <div>
                    <span>{alternative}</span>
                    <div>
                      <i style={{ width: `${Math.max(4, (comparison.value.alternative.annualKg / Math.max(1, comparison.value.baseline.annualKg)) * 100)}%` }} />
                    </div>
                    <strong>{comparison.value.alternative.annualKg.toFixed(0)} kg/yr</strong>
                  </div>
                </div>

                <div className="savings-grid">
                  <div><small>Weekly saving</small><strong>{comparison.value.weeklySavingsKg.toFixed(2)} kg</strong></div>
                  <div><small>Monthly saving</small><strong>{comparison.value.monthlySavingsKg.toFixed(1)} kg</strong></div>
                  <div><small>Annual saving</small><strong>{comparison.value.annualSavingsKg.toFixed(1)} kg</strong></div>
                </div>

                <div className="method-note">
                  <Info size={16} aria-hidden="true" />
                  <div>
                    <p><strong>Method ({TRANSPORT_FACTOR_VERSION}):</strong> one-way distance × 2 × travel days × 52 × kg CO₂e per passenger-km. Carpool divides the car factor by occupants.</p>
                    <p><strong>Assumptions:</strong> {comparison.value.assumptions.join(' ')}</p>
                    <p><strong>Factor source:</strong> {comparison.value.factorSource}</p>
                    <p><strong>What this does not show:</strong> {TRANSPORT_FACTORS[alternative].note} Personal emissions avoided do not demonstrate an immediate city AQI change.</p>
                  </div>
                </div>
              </>
            )}
            {comparison.error && <p className="form-message error" id="transport-error" role="alert">{comparison.error}</p>}
          </section>
        </div>
      )}

      {tab === 'exposure' && (
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
              <input id="exposure-hours" type="range" min={1} max={6} value={hours} onChange={event => setHours(Number(event.target.value))} />
            </label>
            <p className="data-note">
              Baseline uses the next hourly model value. Alternative uses the relatively cleaner forecast window from
              the daily planner: {planner.bestWindow ? `${planner.bestWindow.start}–${planner.bestWindow.end}` : 'unavailable'}.
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
      )}

      {tab === 'indoor' && (
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
      )}

      {tab === 'alternatives' && (
        <div className="alternatives-panel" role="tabpanel" id="panel-alternatives" aria-labelledby="tab-alternatives">
          <section aria-labelledby="transport-alternatives-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">TRANSPORT</p>
                <h2 id="transport-alternatives-heading">Alternatives for a {distance} km one-way trip, {days} days a week</h2>
              </div>
            </div>
            <p className="data-note">
              Current behaviour: {profile.commute}. The figures below compare each option with a single-occupant petrol
              car baseline using factors {TRANSPORT_FACTOR_VERSION}. They are personal transport emissions, not a
              city-wide AQI change.{' '}
              <button type="button" className="text-link" onClick={() => setTab('transport')}>
                Adjust distance and travel days
              </button>
            </p>

            <div className="alternatives-grid">
              {COMMUTE_MODES.filter(mode => mode !== profile.commute).map(mode => {
                let estimate: { annualKg: number; annualSavingsKg: number; annualSavingsLowKg: number; annualSavingsHighKg: number } | null = null
                try {
                  const result = compareTransport({ oneWayKm: distance, daysPerWeek: days, alternative: mode, occupancy })
                  estimate = {
                    annualKg: result.alternative.annualKg,
                    annualSavingsKg: result.annualSavingsKg,
                    annualSavingsLowKg: result.annualSavingsLowKg,
                    annualSavingsHighKg: result.annualSavingsHighKg,
                  }
                } catch {
                  estimate = null
                }
                const notes = MODE_NOTES[mode]
                return (
                  <article key={mode} className="alternative-card">
                    <div className="alternative-head">
                      <h3>{mode}</h3>
                      <span>{estimate ? `${estimate.annualKg.toFixed(0)} kg CO₂e/yr` : 'Not calculable'}</span>
                    </div>
                    <dl>
                      <div><dt>Current behaviour</dt><dd>{profile.commute}</dd></div>
                      <div><dt>Suggested alternative</dt><dd>{mode}</dd></div>
                      <div><dt>Cost difference</dt><dd>{notes.cost}</dd></div>
                      <div><dt>Practicality</dt><dd>{notes.practicality}</dd></div>
                      <div><dt>Environmental benefit</dt><dd>{notes.benefit}</dd></div>
                      <div>
                        <dt>Estimated avoided emissions</dt>
                        <dd>
                          {estimate
                            ? `${estimate.annualSavingsKg.toFixed(0)} kg CO₂e/yr vs a solo petrol car (range ${estimate.annualSavingsLowKg.toFixed(0)}–${estimate.annualSavingsHighKg.toFixed(0)} kg, ±20% planning uncertainty).`
                            : 'Not calculable for the current inputs.'}
                        </dd>
                      </div>
                    </dl>
                    <p className="data-note">
                      <strong>Method:</strong> one-way km × 2 × days/week × 52 × per-passenger factor (
                      {TRANSPORT_FACTORS[mode].kgCo2ePerPassengerKm.toFixed(3)} kg CO₂e/km).{' '}
                      {TRANSPORT_FACTORS[mode].note}
                    </p>
                  </article>
                )
              })}
            </div>
          </section>

          <section aria-labelledby="household-alternatives-heading" className="alternatives-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">HOUSEHOLD</p>
                <h2 id="household-alternatives-heading">Cleaner routines at home</h2>
              </div>
            </div>
            <div className="alternatives-grid">
              {HOUSEHOLD_ALTERNATIVES.map(item => (
                <article key={item.id} className="alternative-card">
                  <div className="alternative-head">
                    <h3>{item.title}</h3>
                    <span>{item.evidenceLevel} evidence</span>
                  </div>
                  <dl>
                    <div><dt>Current behaviour</dt><dd>{item.currentBehaviour}</dd></div>
                    <div><dt>Suggested alternative</dt><dd>{item.alternative}</dd></div>
                    <div><dt>Cost difference</dt><dd>{item.cost}</dd></div>
                    <div><dt>Practicality</dt><dd>{item.practicality}</dd></div>
                    <div><dt>Environmental benefit</dt><dd>{item.environmentalBenefit}</dd></div>
                    <div><dt>Estimated avoided emissions</dt><dd>{item.estimatedAvoidedEmissions}</dd></div>
                  </dl>
                  <p className="data-note"><strong>Method:</strong> {item.methodology}</p>
                  <p className="data-note"><strong>Limitations:</strong> {item.limitations}</p>
                  <p className="data-note"><strong>Sources:</strong> {item.sources.join(' · ')}</p>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="community-alternatives-heading" className="alternatives-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">COMMUNITY</p>
                <h2 id="community-alternatives-heading">Collective action nearby</h2>
              </div>
            </div>
            <div className="alternatives-grid">
              {COMMUNITY_ALTERNATIVES.map(item => (
                <article key={item.id} className="alternative-card">
                  <div className="alternative-head">
                    <h3>{item.title}</h3>
                    <span>{item.evidenceLevel} evidence</span>
                  </div>
                  <dl>
                    <div><dt>Current behaviour</dt><dd>{item.currentBehaviour}</dd></div>
                    <div><dt>Suggested alternative</dt><dd>{item.alternative}</dd></div>
                    <div><dt>Cost difference</dt><dd>{item.cost}</dd></div>
                    <div><dt>Practicality</dt><dd>{item.practicality}</dd></div>
                    <div><dt>Environmental benefit</dt><dd>{item.environmentalBenefit}</dd></div>
                    <div><dt>Estimated avoided emissions</dt><dd>{item.estimatedAvoidedEmissions}</dd></div>
                  </dl>
                  <p className="data-note"><strong>Method:</strong> {item.methodology}</p>
                  <p className="data-note"><strong>Limitations:</strong> {item.limitations}</p>
                  <p className="data-note"><strong>Sources:</strong> {item.sources.join(' · ')}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="method-note">
            <Users size={16} aria-hidden="true" />
            <p>
              Household and community actions are shown qualitatively. Vayu does not invent tonnage for measures it
              cannot measure, and does not claim that individual action instantly changes city-wide AQI.
            </p>
          </div>
          <p className="page-footnote">
            <Leaf size={14} aria-hidden="true" /> Emissions avoided, outdoor concentration and personal exposure are
            different quantities. Only the transport figures here are numeric, and they are planning estimates.
          </p>
        </div>
      )}

      <p className="page-footnote">
        <TrendingDown size={14} aria-hidden="true" /> Personal emissions, outdoor concentration and personal exposure
        are different quantities. Vayu keeps them separate.
      </p>
    </div>
  )
}

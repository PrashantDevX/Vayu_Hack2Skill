import { Leaf, Users } from 'lucide-react'
import { COMMUTE_MODES } from '../../constants/aqi'
import { COMMUNITY_ALTERNATIVES, HOUSEHOLD_ALTERNATIVES } from '../../constants/alternatives'
import { compareTransport, TRANSPORT_FACTORS, TRANSPORT_FACTOR_VERSION } from '../../utils/impact'
import type { CommuteMode, Profile } from '../../types'
import { AlternativeCard } from './AlternativeCard'

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

interface AlternativesPanelProps {
  distance: number
  days: number
  occupancy: number
  profile: Profile
  onAdjustTransport: () => void
}

export function AlternativesPanel({ distance, days, occupancy, profile, onAdjustTransport }: AlternativesPanelProps) {
  return (
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
          <button type="button" className="text-link" onClick={onAdjustTransport}>
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
          {HOUSEHOLD_ALTERNATIVES.map(item => <AlternativeCard key={item.id} item={item} />)}
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
          {COMMUNITY_ALTERNATIVES.map(item => <AlternativeCard key={item.id} item={item} />)}
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
  )
}

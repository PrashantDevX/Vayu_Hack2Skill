import { useState } from 'react'
import { AlertTriangle, Check, Filter, Home, ShieldCheck, SlidersHorizontal, Wind } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { KeyReadings } from '../components/KeyReadings'
import { PageHeading } from '../components/PageHeading'
import { useTransientFlag } from '../hooks/useTransientFlag'
import { BUDGET_BANDS } from '../constants/aqi'
import { budgetRank, estimateCadr } from '../utils/impact'
import type { BudgetBand } from '../types'
interface IndoorAction {
  title: string
  timing: string
  detail: string
  benefit: string
  limitation: string
  minBudget: BudgetBand
}

const ACTIONS: IndoorAction[] = [
  {
    title: 'Damp-dust and mop instead of dry sweeping',
    timing: 'Today, then 2–3 times a week',
    detail: 'Use a damp cloth and mop to remove settled dust without resuspending it. Vacuum with a sealed HEPA filter if available.',
    benefit: 'Reduces resuspended indoor particles at no purchase cost.',
    limitation: 'Does not remove gases or eliminate outdoor ingress; cleaning products can add their own emissions.',
    minBudget: 'Free',
  },
  {
    title: 'Run the kitchen exhaust every time you cook',
    timing: 'During cooking and for a few minutes after',
    detail: 'Vent cooking emissions outdoors. Avoid indoor smoking, incense and unnecessary combustion.',
    benefit: 'Targets a major indoor particle source, especially with gas, biomass or mixed cooking.',
    limitation: 'Exhaust effectiveness depends on ducting and make-up air; it can pull in outdoor air if the home is sealed.',
    minBudget: 'Free',
  },
  {
    title: 'Fix obvious leaks and keep filters clean',
    timing: 'This week',
    detail: 'Seal obvious draughts around windows and doors where safe, and clean or replace purifier filters on the manufacturer schedule.',
    benefit: 'Improves filtration performance and reduces avoidable particle ingress.',
    limitation: 'Do not seal combustion appliances or block required ventilation. Avoid unsafe DIY electrical work.',
    minBudget: 'Under ₹1,500',
  },
  {
    title: 'Choose a certified HEPA unit sized to the room',
    timing: 'Before purchase',
    detail: 'Compare the rated CADR with the room target below, check filter replacement cost and noise, and place the unit where air can circulate.',
    benefit: 'Correctly sized HEPA filtration can lower indoor particulate concentrations.',
    limitation: 'No exact indoor PM2.5 reduction is claimed without an indoor sensor or validated model. Ozone generators are never recommended.',
    minBudget: '₹1,500–₹12,000',
  },
  {
    title: 'Plan filtration, placement and maintenance as a system',
    timing: 'Ongoing',
    detail: 'Use a certified HEPA unit close to the breathing zone, keep doors and windows closed during high outdoor pollution, and budget for genuine replacement filters.',
    benefit: 'Sustained filtration performance rather than a one-off purchase.',
    limitation: 'Performance falls if filters are clogged or the unit is undersized. Filtration is not a substitute for source control.',
    minBudget: 'Premium solutions',
  },
]

export default function IndoorAir() {
  const { profile, updateProfile } = useApp()
  const [area, setArea] = useState(profile.roomAreaSqFt)
  const [ceiling, setCeiling] = useState(9)
  const [budget, setBudget] = useState<BudgetBand>(profile.budget)
  const [hasPurifier, setHasPurifier] = useState(profile.hasPurifier)
  const [saved, showSaved] = useTransientFlag()

  const vulnerable = profile.children > 0 || profile.elderly > 0 || profile.respiratorySensitivity || profile.cardiovascularSensitivity
  const cadr = estimateCadr({ areaSqFt: area, ceilingFt: ceiling, achLow: 4, achHigh: vulnerable ? 6 : 5 })
  const visibleActions = ACTIONS.filter(action => budgetRank(action.minBudget) <= budgetRank(budget) || action.minBudget === 'Free')

  const save = () => {
    updateProfile({ ...profile, roomAreaSqFt: area, budget, hasPurifier })
    showSaved()
  }

  return (
    <div className="page">
      <PageHeading
        eyebrow="HOME ENVIRONMENT"
        title="Indoor air"
        description="Source control first, then appropriately sized filtration. No ozone devices, no unsafe DIY."
      />

      <section className="indoor-summary" aria-labelledby="indoor-summary-heading">
        <div>
          <p className="eyebrow">THE SHORT ANSWER</p>
          <h2 id="indoor-summary-heading">
            Start with free source control; size any purifier to this room
          </h2>
          <p>
            Damp-dusting, kitchen exhaust and avoiding indoor combustion cost nothing and come first. Only then does
            filtration help — and only when the unit is rated for the space.
          </p>
        </div>
        <KeyReadings
          label="Room sizing result"
          items={[
            { label: 'Suggested CADR', value: `${cadr.cadrM3hLow}–${cadr.cadrM3hHigh} m³/h` },
            { label: 'Room volume', value: `${cadr.volumeM3} m³` },
            { label: 'Air changes/hour', value: `${cadr.achLow}–${cadr.achHigh}` },
            { label: 'Budget', value: budget },
          ]}
        />
      </section>

      <div className="indoor-layout">
        <section className="room-card" aria-labelledby="room-heading">
          <div className="card-heading">
            <div>
              <small>ROOM CONFIGURATOR</small>
              <h2 id="room-heading">Bedroom setup</h2>
            </div>
            <SlidersHorizontal size={18} aria-hidden="true" />
          </div>

          <label htmlFor="room-area">
            Approximate room area: <strong>{area} sq ft</strong>
            <input id="room-area" type="range" min={60} max={800} step={10} value={area} onChange={event => setArea(Number(event.target.value))} />
          </label>
          <label htmlFor="room-ceiling">
            Ceiling height: <strong>{ceiling} ft</strong>
            <input id="room-ceiling" type="range" min={7} max={14} step={0.5} value={ceiling} onChange={event => setCeiling(Number(event.target.value))} />
          </label>
          <label htmlFor="room-budget">
            Budget
            <select id="room-budget" value={budget} onChange={event => {
              const next = BUDGET_BANDS.find(band => band === event.target.value)
              if (next !== undefined) setBudget(next)
            }}>
              {BUDGET_BANDS.map(band => <option key={band}>{band}</option>)}
            </select>
          </label>
          <label className="toggle-label standalone" htmlFor="room-purifier">
            <span>We already have a purifier</span>
            <input id="room-purifier" type="checkbox" checked={hasPurifier} onChange={event => setHasPurifier(event.target.checked)} />
          </label>

          <div className="room-result">
            <div>
              <small>Suggested CADR</small>
              <strong>{cadr.cadrM3hLow}–{cadr.cadrM3hHigh} m³/h</strong>
            </div>
            <span>{cadr.volumeM3} m³ room volume · {cadr.achLow}–{cadr.achHigh} air changes/hour</span>
          </div>

          <p className="safety-note">
            <ShieldCheck size={16} aria-hidden="true" /> Certified HEPA filtration with clean filters. Never use ozone
            generators. This is a sizing estimate, not a guaranteed indoor PM2.5 reduction.
          </p>

          <button type="button" className="primary-button full-width" onClick={save}>
            {saved ? <><Check size={16} aria-hidden="true" /> Saved</> : 'Save room setup to profile'}
          </button>
        </section>

        <section className="indoor-recs" aria-labelledby="indoor-actions-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">RECOMMENDED NEXT STEPS</p>
              <h2 id="indoor-actions-heading">Fits your {budget.toLowerCase()} budget</h2>
            </div>
          </div>

          <div className="indoor-grid">
            {visibleActions.map((action, index) => (
              <article key={action.title}>
                <span className="rec-number">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <small>{action.minBudget.toUpperCase()} · {action.timing}</small>
                  <h3>{action.title}</h3>
                  <p>{action.detail}</p>
                  <p className="data-note"><strong>Benefit:</strong> {action.benefit}</p>
                  <p className="data-note"><strong>Limitation:</strong> {action.limitation}</p>
                </div>
              </article>
            ))}
          </div>

          <section className="indoor-comparison" aria-labelledby="compare-heading">
            <h3 id="compare-heading">Source control vs filtration vs ventilation</h3>
            <div className="comparison-table">
              <div><strong>Source control</strong><span>Free</span><p>Stops particles at the source. Do this first.</p></div>
              <div><strong>Filtration</strong><span>{budget}</span><p>Helps when the unit is correctly sized and maintained. No exact reduction is claimed.</p></div>
              <div><strong>Ventilation</strong><span>Free</span><p>Only when outdoor pollution is lower than indoor sources warrant. Balance both.</p></div>
            </div>
          </section>
        </section>
      </div>

      <div className="insights-grid indoor-safety">
        <section className="insight-card">
          <div className="insight-icon amber"><AlertTriangle size={20} aria-hidden="true" /></div>
          <div>
            <small>NEVER RECOMMENDED</small>
            <h3>Ozone generators and unsafe DIY</h3>
            <p>Ozone-generating devices can irritate the airways. Do not build unsafe electrical filtration devices or rely on houseplants to replace filtration.</p>
          </div>
        </section>
        <section className="insight-card">
          <div className="insight-icon green"><Wind size={20} aria-hidden="true" /></div>
          <div>
            <small>VENTILATION DECISION</small>
            <h3>Check outdoor levels first</h3>
            <p>Do not blindly open windows when outdoor pollution is high. Use the hourly forecast and balance outdoor particles with indoor cooking, damp and occupancy sources.</p>
          </div>
        </section>
      </div>

      <p className="page-footnote">
        <Filter size={14} aria-hidden="true" /> Room sizing uses {cadr.achLow}–{cadr.achHigh} air changes per hour at a{' '}
        {ceiling} ft ceiling. Real performance depends on the unit, room leakage, filter condition and noise level.
      </p>
      <p className="page-footnote">
        <Home size={14} aria-hidden="true" /> Vayu does not recommend devices that intentionally generate ozone.
      </p>
    </div>
  )
}

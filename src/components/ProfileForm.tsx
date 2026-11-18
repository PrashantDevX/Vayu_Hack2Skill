import { BUDGET_BANDS, COMMUTE_MODES } from '../constants/aqi'
import type { Profile } from '../types'

type Section = 'all' | 'household' | 'lifestyle'

interface ProfileFormProps {
  value: Profile
  onChange: (profile: Profile) => void
  section?: Section
  idPrefix?: string
}

export function ProfileForm({ value, onChange, section = 'all', idPrefix = 'profile' }: ProfileFormProps) {
  const set = <K extends keyof Profile>(key: K, next: Profile[K]) => {
    onChange({ ...value, [key]: next })
  }
  const showHousehold = section === 'all' || section === 'household'
  const showLifestyle = section === 'all' || section === 'lifestyle'

  return (
    <div className="profile-form">
      {showHousehold && (
        <fieldset>
          <legend>Household</legend>
          <div className="form-grid">
            <label htmlFor={`${idPrefix}-adults`}>
              Adults (18–64)
              <input id={`${idPrefix}-adults`} type="number" min={0} max={20} value={value.adults} onChange={event => set('adults', Number(event.target.value))} />
            </label>
            <label htmlFor={`${idPrefix}-children`}>
              Children
              <input id={`${idPrefix}-children`} type="number" min={0} max={20} value={value.children} onChange={event => set('children', Number(event.target.value))} />
            </label>
            <label htmlFor={`${idPrefix}-elderly`}>
              Older adults (65+)
              <input id={`${idPrefix}-elderly`} type="number" min={0} max={20} value={value.elderly} onChange={event => set('elderly', Number(event.target.value))} />
            </label>
          </div>
          <div className="checkbox-grid">
            <label className="toggle-label" htmlFor={`${idPrefix}-outdoor`}>
              <span>Outdoor worker</span>
              <input id={`${idPrefix}-outdoor`} type="checkbox" checked={value.outdoorWorker} onChange={event => set('outdoorWorker', event.target.checked)} />
            </label>
            <label className="toggle-label" htmlFor={`${idPrefix}-respiratory`}>
              <span>Respiratory sensitivity</span>
              <input id={`${idPrefix}-respiratory`} type="checkbox" checked={value.respiratorySensitivity} onChange={event => set('respiratorySensitivity', event.target.checked)} />
            </label>
            <label className="toggle-label" htmlFor={`${idPrefix}-cardio`}>
              <span>Cardiovascular sensitivity</span>
              <input id={`${idPrefix}-cardio`} type="checkbox" checked={value.cardiovascularSensitivity} onChange={event => set('cardiovascularSensitivity', event.target.checked)} />
            </label>
          </div>
        </fieldset>
      )}

      {showLifestyle && (
        <fieldset>
          <legend>Routine and home</legend>
          <div className="form-grid">
            <label htmlFor={`${idPrefix}-commute`}>
              Usual commute
              <select id={`${idPrefix}-commute`} value={value.commute} onChange={event => set('commute', event.target.value as Profile['commute'])}>
                {COMMUTE_MODES.map(mode => <option key={mode}>{mode}</option>)}
              </select>
            </label>
            <label htmlFor={`${idPrefix}-distance`}>
              One-way distance (km)
              <input id={`${idPrefix}-distance`} type="number" min={0} max={300} step={0.5} value={value.commuteDistanceKm} onChange={event => set('commuteDistanceKm', Number(event.target.value))} />
            </label>
            <label htmlFor={`${idPrefix}-timing`}>
              Work or school timing
              <select id={`${idPrefix}-timing`} value={value.workTiming} onChange={event => set('workTiming', event.target.value as Profile['workTiming'])}>
                {['Early morning', 'Daytime', 'Evening', 'Night', 'Flexible'].map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label htmlFor={`${idPrefix}-exercise`}>
              Outdoor exercise
              <select id={`${idPrefix}-exercise`} value={value.exerciseFrequency} onChange={event => set('exerciseFrequency', event.target.value as Profile['exerciseFrequency'])}>
                {['Rarely', '1–2 times a week', '3–4 times a week', 'Daily'].map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label htmlFor={`${idPrefix}-fuel`}>
              Cooking fuel
              <select id={`${idPrefix}-fuel`} value={value.cookingFuel} onChange={event => set('cookingFuel', event.target.value as Profile['cookingFuel'])}>
                {['LPG or piped gas', 'Electric', 'Biomass or wood', 'Mixed'].map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label htmlFor={`${idPrefix}-ventilation`}>
              Home ventilation
              <select id={`${idPrefix}-ventilation`} value={value.ventilation} onChange={event => set('ventilation', event.target.value as Profile['ventilation'])}>
                {['Good cross-ventilation', 'Single-side windows', 'Poor or sealed'].map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label htmlFor={`${idPrefix}-area`}>
              Bedroom area (sq ft)
              <input id={`${idPrefix}-area`} type="number" min={20} max={5000} value={value.roomAreaSqFt} onChange={event => set('roomAreaSqFt', Number(event.target.value))} />
            </label>
            <label htmlFor={`${idPrefix}-budget`}>
              Budget
              <select id={`${idPrefix}-budget`} value={value.budget} onChange={event => set('budget', event.target.value as Profile['budget'])}>
                {BUDGET_BANDS.map(band => <option key={band}>{band}</option>)}
              </select>
            </label>
          </div>
          <label className="toggle-label standalone" htmlFor={`${idPrefix}-purifier`}>
            <span>We already have an air purifier</span>
            <input id={`${idPrefix}-purifier`} type="checkbox" checked={value.hasPurifier} onChange={event => set('hasPurifier', event.target.checked)} />
          </label>
        </fieldset>
      )}
    </div>
  )
}

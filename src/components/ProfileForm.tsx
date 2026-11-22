import { useEffect, useState } from 'react'
import {
  BUDGET_BANDS,
  COMMUTE_MODES,
  COOKING_FUELS,
  EXERCISE_FREQUENCIES,
  VENTILATION_QUALITIES,
  WORK_TIMINGS,
} from '../constants/profileOptions'
import type { Profile } from '../types'

type Section = 'all' | 'household' | 'lifestyle'

interface ProfileFormProps {
  value: Profile
  onChange: (profile: Profile) => void
  section?: Section
  idPrefix?: string
}

interface NumberFieldProps {
  id: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}

function NumberField({ id, label, value, min, max, step, onChange }: NumberFieldProps) {
  const [text, setText] = useState(() => String(value))
  const parsed = text.trim() === '' ? null : Number(text)
  const [editing, setEditing] = useState(false)
  // Out-of-range input used to be dropped silently while the typed text stayed
  // on screen, so the field looked accepted. Expose the invalid state instead.
  const invalid = parsed !== null && (!Number.isFinite(parsed) || parsed < min || parsed > max)
  const hintId = `${id}-hint`

  useEffect(() => {
    if (!editing) {
      // Synchronise a saved/external profile reset while preserving local typed text.
      // oxlint-disable-next-line react/set-state-in-effect
      setText(String(value))
    }
  }, [editing, value])

  const commit = (nextText: string) => {
    setText(nextText)
    if (nextText.trim() === '') return
    const nextValue = Number(nextText)
    if (!Number.isFinite(nextValue)) return
    if (nextValue < min || nextValue > max) return
    onChange(nextValue)
  }

  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={text}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? hintId : undefined}
        onFocus={() => setEditing(true)}
        onChange={event => commit(event.target.value)}
        onBlur={() => {
          setEditing(false)
          if (text.trim() === '' || invalid) setText(String(value))
        }}
      />
      {invalid && (
        <span id={hintId} className="field-hint error" role="alert">
          Enter a value between {min} and {max}.
        </span>
      )}
    </label>
  )
}

export function ProfileForm({ value, onChange, section = 'all', idPrefix = 'profile' }: ProfileFormProps) {
  const set = <K extends keyof Profile>(key: K, next: Profile[K]) => {
    onChange({ ...value, [key]: next })
  }
  const setOption = <K extends keyof Profile>(key: K, options: readonly Profile[K][], raw: string) => {
    const next = options.find(option => option === raw)
    if (next !== undefined) set(key, next)
  }
  const showHousehold = section === 'all' || section === 'household'
  const showLifestyle = section === 'all' || section === 'lifestyle'

  return (
    <div className="profile-form">
      {showHousehold && (
        <fieldset>
          <legend>Household</legend>
          <div className="form-grid">
            <NumberField
              id={`${idPrefix}-adults`}
              label="Adults (18–64)"
              value={value.adults}
              min={0}
              max={20}
              onChange={next => set('adults', next)}
            />
            <NumberField
              id={`${idPrefix}-children`}
              label="Children"
              value={value.children}
              min={0}
              max={20}
              onChange={next => set('children', next)}
            />
            <NumberField
              id={`${idPrefix}-elderly`}
              label="Older adults (65+)"
              value={value.elderly}
              min={0}
              max={20}
              onChange={next => set('elderly', next)}
            />
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
              <select id={`${idPrefix}-commute`} value={value.commute} onChange={event => setOption('commute', COMMUTE_MODES, event.target.value)}>
                {COMMUTE_MODES.map(mode => <option key={mode}>{mode}</option>)}
              </select>
            </label>
            <NumberField
              id={`${idPrefix}-distance`}
              label="One-way distance (km)"
              value={value.commuteDistanceKm}
              min={0}
              max={300}
              step={0.5}
              onChange={next => set('commuteDistanceKm', next)}
            />
            <label htmlFor={`${idPrefix}-timing`}>
              Work or school timing
              <select id={`${idPrefix}-timing`} value={value.workTiming} onChange={event => setOption('workTiming', WORK_TIMINGS, event.target.value)}>
                {WORK_TIMINGS.map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label htmlFor={`${idPrefix}-exercise`}>
              Outdoor exercise
              <select id={`${idPrefix}-exercise`} value={value.exerciseFrequency} onChange={event => setOption('exerciseFrequency', EXERCISE_FREQUENCIES, event.target.value)}>
                {EXERCISE_FREQUENCIES.map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label htmlFor={`${idPrefix}-fuel`}>
              Cooking fuel
              <select id={`${idPrefix}-fuel`} value={value.cookingFuel} onChange={event => setOption('cookingFuel', COOKING_FUELS, event.target.value)}>
                {COOKING_FUELS.map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label htmlFor={`${idPrefix}-ventilation`}>
              Home ventilation
              <select id={`${idPrefix}-ventilation`} value={value.ventilation} onChange={event => setOption('ventilation', VENTILATION_QUALITIES, event.target.value)}>
                {VENTILATION_QUALITIES.map(option => <option key={option}>{option}</option>)}
              </select>
            </label>
            <NumberField
              id={`${idPrefix}-area`}
              label="Bedroom area (sq ft)"
              value={value.roomAreaSqFt}
              min={20}
              max={5000}
              onChange={next => set('roomAreaSqFt', next)}
            />
            <label htmlFor={`${idPrefix}-budget`}>
              Budget
              <select id={`${idPrefix}-budget`} value={value.budget} onChange={event => setOption('budget', BUDGET_BANDS, event.target.value)}>
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

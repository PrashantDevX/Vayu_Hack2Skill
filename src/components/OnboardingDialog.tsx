import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, MapPin, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react'
import { Modal } from './Modal'
import { LocationSearch } from './LocationSearch'
import { ProfileForm } from './ProfileForm'
import { useApp } from '../context/AppContext'
import { profileSchema } from '../utils/profile'
import type { Profile } from '../types'

interface OnboardingDialogProps {
  open: boolean
  onClose: () => void
}

const STEPS = [
  { label: 'Location', description: 'Choose where Vayu should plan', icon: MapPin },
  { label: 'Household', description: 'Tell us who needs care', icon: Users },
  { label: 'Routine', description: 'Match advice to daily life', icon: SlidersHorizontal },
] as const

export function OnboardingDialog({ open, onClose }: OnboardingDialogProps) {
  const { profile, updateProfile, location, setLocation, setOnboarded } = useApp()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Profile>(profile)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      // Reset the local draft whenever the dialog is reopened.
      // eslint-disable-next-line react/set-state-in-effect
      setStep(0)
      setDraft(profile)
      setMessage(null)
    }
  }, [open, profile])

  const finish = () => {
    const parsed = profileSchema.safeParse(draft)
    if (!parsed.success) {
      setMessage('Check the household counts, commute distance and room area before saving.')
      return
    }
    updateProfile(parsed.data)
    setOnboarded(true)
    onClose()
  }

  const skip = () => {
    setOnboarded(true)
    onClose()
  }

  return (
    <Modal open={open} onClose={skip} eyebrow="Personalise Vayu" title="Set up your household plan" className="onboarding-modal">
      <div className="onboarding-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((item, index) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className={`onboarding-step-chip ${index === step ? 'current' : index < step ? 'done' : ''}`}
            >
              <span className="step-icon"><Icon size={15} aria-hidden="true" /></span>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
            </div>
          )
        })}
      </div>
      <div className="onboarding-progress-track" aria-hidden="true">
        <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {step === 0 && (
        <div className="onboarding-step">
          <div className="onboarding-step-title">
            <div>
              <small>STEP 1 OF 3</small>
              <h3>Where should we check the air?</h3>
            </div>
            <span className="privacy-chip"><ShieldCheck size={14} aria-hidden="true" /> Approximate location only</span>
          </div>
          <p className="dialog-copy">
            Choose a city or use approximate browser location. Location permission is optional; search always works.
          </p>
          <p className="current-location"><MapPin size={16} aria-hidden="true" /> Current: <strong>{location.city}</strong></p>
          <LocationSearch compact onSelect={setLocation} />
        </div>
      )}

      {step === 1 && (
        <div className="onboarding-step">
          <div className="onboarding-step-title">
            <div><small>STEP 2 OF 3</small><h3>Who is in your household?</h3></div>
          </div>
          <p className="dialog-copy">
            Only non-identifying categories are stored, locally in this browser. Names, diagnoses and exact GPS
            coordinates are never collected.
          </p>
          <ProfileForm value={draft} onChange={setDraft} section="household" idPrefix="onboard" />
        </div>
      )}

      {step === 2 && (
        <div className="onboarding-step">
          <div className="onboarding-step-title">
            <div><small>STEP 3 OF 3</small><h3>What does a typical day look like?</h3></div>
          </div>
          <p className="dialog-copy">
            These details shape commute, indoor-air and budget guidance. Optional fields can stay at their defaults
            and be edited later in Settings.
          </p>
          <ProfileForm value={draft} onChange={setDraft} section="lifestyle" idPrefix="onboard" />
        </div>
      )}

      {message && <p className="form-message error" role="alert">{message}</p>}

      <div className="onboarding-actions">
        <button type="button" className="text-link" onClick={skip}>Use defaults</button>
        <div>
          {step > 0 && (
            <button type="button" className="secondary-button" onClick={() => setStep(current => current - 1)}>
              <ArrowLeft size={16} aria-hidden="true" /> Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="primary-button" onClick={() => setStep(current => current + 1)}>
              Next <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className="primary-button" onClick={finish}>Save and continue</button>
          )}
        </div>
      </div>
    </Modal>
  )
}

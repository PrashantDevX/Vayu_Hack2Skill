import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Briefcase, ClipboardCopy, GraduationCap, HeartPulse, Share2, ShieldCheck, Users } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { PageHeading } from '../components/PageHeading'
import { useTransientFlag } from '../hooks/useTransientFlag'
import { CATEGORY_SUMMARY } from '../constants/aqi'
import { buildShareText, copyToClipboard } from '../utils/share'

export default function FamilyProtection() {
  const { air, profile, planner, location } = useApp()
  const [copied, showCopied] = useTransientFlag()
  const [copyFailed, setCopyFailed] = useState(false)
  const assessment = air.data?.model.assessment
  const category = assessment?.category ?? null
  const elevated = assessment?.aqi !== null && assessment?.aqi !== undefined && assessment.aqi > 100
  const severe = assessment?.aqi !== null && assessment?.aqi !== undefined && assessment.aqi > 300
  const cleanerWindow = planner.bestWindow ? `${planner.bestWindow.start}–${planner.bestWindow.end}` : null
  const shareText = buildShareText({ city: location.city, assessment, planner })

  const share = async () => {
    setCopyFailed(false)
    const ok = await copyToClipboard(shareText)
    if (ok) showCopied()
    else setCopyFailed(true)
  }

  const groups = [
    {
      title: 'Children & students',
      icon: GraduationCap,
      applies: profile.children > 0,
      text: severe
        ? 'Keep outdoor school travel short, move strenuous games indoors, and follow school guidance. A well-fitting particulate respirator can be used for essential travel if local guidance allows; it should not replace reducing exposure.'
        : elevated
          ? 'Prefer the cleaner travel window, keep outdoor play flexible and avoid busy roads at drop-off and pick-up.'
          : 'Normal outdoor activity is reasonable. Prefer quieter routes and keep an eye on the hourly forecast.',
    },
    {
      title: 'Older adults',
      icon: HeartPulse,
      applies: profile.elderly > 0,
      text: elevated
        ? 'Move errands and walks to the cleaner forecast window, avoid sudden strenuous exertion, and keep current medical plans accessible. Seek medical advice if symptoms worsen.'
        : 'Normal activity is reasonable. Prefer the cleaner window and quieter routes, especially with existing heart or lung conditions.',
    },
    {
      title: 'Outdoor workers',
      icon: Briefcase,
      applies: profile.outdoorWorker,
      text: elevated
        ? 'Shift strenuous tasks away from the higher-pollution window, take breaks in a cleaner indoor area, and discuss exposure controls with your employer.'
        : 'Use the cleaner forecast window for strenuous tasks and keep water and breaks available.',
    },
    {
      title: 'Respiratory sensitivity',
      icon: Users,
      applies: profile.respiratorySensitivity,
      text: severe
        ? 'Minimise outdoor exposure, keep reliever medication accessible as prescribed, and seek medical care for severe breathlessness or chest pain. Vayu does not diagnose or prescribe.'
        : elevated
          ? 'Reduce prolonged outdoor exertion and choose the cleaner forecast window. Follow your clinician’s plan if symptoms change.'
          : 'Continue usual activity, but reduce exertion if you notice coughing or wheezing.',
    },
    {
      title: 'Cardiovascular sensitivity',
      icon: HeartPulse,
      applies: profile.cardiovascularSensitivity,
      text: severe
        ? 'Avoid outdoor exertion and follow your clinician’s advice. Seek urgent care for chest pain or severe shortness of breath.'
        : elevated
          ? 'Keep outdoor exertion light and use the cleaner forecast window. Do not stop prescribed medication without medical advice.'
          : 'Normal activity is generally reasonable; reduce intensity if you feel unwell.',
    },
  ]

  return (
    <div className="page">
      <PageHeading
        eyebrow="FAMILY SAFETY"
        title="Family protection"
        description="Practical guidance for household members with different needs. Not a diagnosis or prescription."
      />

      <div className="family-banner">
        <ShieldCheck size={25} aria-hidden="true" />
        <div>
          <strong>
            {assessment?.aqi !== null && assessment?.aqi !== undefined && category
              ? `${category}: ${CATEGORY_SUMMARY[category]}`
              : 'AQI unavailable: use general precautions and recheck provider data.'}
          </strong>
          <p>
            Current estimated model AQI: {assessment?.aqi ?? 'unavailable'}.
            {cleanerWindow ? ` The relatively cleaner window is ${cleanerWindow}.` : ' No cleaner window could be identified from the hourly series.'}{' '}
            Guidance below uses the household profile and public-health precautions, not individual medical assessment.
          </p>
        </div>
      </div>

      <div className="family-grid">
        {[...groups].sort((a, b) => Number(b.applies) - Number(a.applies)).map(({ title, icon: Icon, applies, text }) => (
          <section key={title} className={applies ? 'applies' : ''}>
            <div className="family-icon"><Icon size={21} aria-hidden="true" /></div>
            <small>{applies ? 'IN YOUR HOUSEHOLD' : 'GENERAL GUIDANCE'}</small>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
      </div>

      <section className="mask-card">
        <div>
          <small>WHEN USING A MASK</small>
          <h2>Fit matters more than the label</h2>
        </div>
        <p>
          Choose a genuine, well-fitting particulate respirator (N95/FFP2 or equivalent) for essential outdoor travel
          when local guidance recommends it. Masks do not make indoor combustion safe, do not replace reducing
          exposure, and should be used according to the manufacturer’s instructions. Follow local public-health
          guidance for children.
        </p>
      </section>

      <section className="share-card" aria-labelledby="share-heading">
        <div className="card-heading">
          <div>
            <small>FAMILY &amp; COMMUNITY</small>
            <h2 id="share-heading">Pass this on</h2>
          </div>
          <Share2 size={20} aria-hidden="true" />
        </div>
        <p>
          Copy a short summary of today&apos;s reading and first actions to send to family, neighbours or a
          community group. It uses only public model values, and actions that exist only because of your
          household profile stay in the app.
        </p>
        <div className="profile-actions">
          <button type="button" className="secondary-button" onClick={() => void share()}>
            <ClipboardCopy size={16} aria-hidden="true" />
            {copied ? 'Copied to clipboard' : 'Copy household guidance'}
          </button>
        </div>
        <p className="data-note" role="status" aria-live="polite">
          {copyFailed
            ? 'Copying is blocked in this browser. Open the preview below and copy the text manually.'
            : copied
              ? 'Copied. Paste it into a message to your household or community group.'
              : ''}
        </p>
        <details className="share-preview">
          <summary>Preview the shared text</summary>
          <pre>{shareText}</pre>
        </details>
      </section>

      <div className="insights-grid family-links">
        <section className="insight-card">
          <div className="insight-icon green"><ShieldCheck size={20} aria-hidden="true" /></div>
          <div>
            <small>SEPARATE DATA SOURCES</small>
            <h3>Model vs official observations</h3>
            <p>Open-Meteo values are CAMS model estimates. Official CPCB readings appear separately when a configured provider returns them.</p>
            <Link className="text-link" to="/air-quality">Check data provenance <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
        </section>
        <section className="insight-card">
          <div className="insight-icon amber"><HeartPulse size={20} aria-hidden="true" /></div>
          <div>
            <small>PUBLIC-HEALTH SOURCES</small>
            <h3>Follow official advice</h3>
            <p>WHO air-quality guidance and CPCB public-health precautions inform this page. They do not replace a clinician’s advice or emergency care.</p>
          </div>
        </section>
      </div>
    </div>
  )
}

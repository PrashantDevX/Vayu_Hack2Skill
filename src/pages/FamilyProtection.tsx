import { Link } from 'react-router-dom'
import { ArrowRight, Briefcase, GraduationCap, HeartPulse, ShieldCheck, Users } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { CATEGORY_SUMMARY } from '../constants/aqi'

export default function FamilyProtection() {
  const { air, profile } = useApp()
  const assessment = air.data?.model.assessment
  const category = assessment?.category ?? null
  const elevated = assessment?.aqi !== null && assessment?.aqi !== undefined && assessment.aqi > 100
  const severe = assessment?.aqi !== null && assessment?.aqi !== undefined && assessment.aqi > 300

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
      <div className="page-heading">
        <div>
          <p className="eyebrow">FAMILY SAFETY</p>
          <h1>Family protection</h1>
          <p>Practical guidance for household members with different needs. Not a diagnosis or prescription.</p>
        </div>
      </div>

      <div className="family-banner">
        <ShieldCheck size={25} aria-hidden="true" />
        <div>
          <strong>
            {assessment?.aqi !== null && assessment?.aqi !== undefined
              ? `${category}: ${CATEGORY_SUMMARY[category ?? 'Moderate']}`
              : 'AQI unavailable: use general precautions and recheck provider data.'}
          </strong>
          <p>
            Current estimated model AQI: {assessment?.aqi ?? 'unavailable'}. Guidance below uses the household profile
            and public-health precautions, not individual medical assessment.
          </p>
        </div>
      </div>

      <div className="family-grid">
        {groups.map(({ title, icon: Icon, applies, text }) => (
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

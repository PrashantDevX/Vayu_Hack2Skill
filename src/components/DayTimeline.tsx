import { Clock3, Moon, Sun } from 'lucide-react'
import { CATEGORY_CLASS } from '../constants/aqi'
import type { AqiAssessment, PollutionWindow } from '../types'

interface DayTimelineProps {
  assessment: AqiAssessment | null
  best: PollutionWindow | null
  worst: PollutionWindow | null
}

interface Moment {
  key: string
  label: string
  time: string
  aqi: string
  note: string
  tone: string
  icon: typeof Clock3
}

/**
 * The "what happens today" layer between the priority message and the detailed
 * numbers. Every value comes from the assessment or the planner windows; when a
 * window is missing the card says so rather than showing a plausible time.
 */
export function DayTimeline({ assessment, best, worst }: DayTimelineProps) {
  const nowTone = assessment?.category ? CATEGORY_CLASS[assessment.category] : 'unavailable'
  const moments: Moment[] = [
    {
      key: 'now',
      label: 'Now',
      time: 'Current hour',
      aqi: assessment?.aqi === null || assessment?.aqi === undefined ? 'Unavailable' : `AQI ${assessment.aqi}`,
      note: assessment?.category ?? 'No overall index for this hour',
      tone: nowTone,
      icon: Clock3,
    },
    {
      key: 'cleaner',
      label: 'Cleaner window',
      time: best ? `${best.start}–${best.end}` : 'Not identified',
      aqi: best?.averageAqi === null || best?.averageAqi === undefined ? 'Unavailable' : `AQI ${best.averageAqi}`,
      note: best
        ? 'Lowest hourly model reading today'
        : 'The hourly series is too incomplete to pick a window',
      tone: 'clean',
      icon: Sun,
    },
    {
      key: 'higher',
      label: 'Higher-pollution window',
      time: worst ? `${worst.start}–${worst.end}` : 'Not identified',
      aqi: worst?.averageAqi === null || worst?.averageAqi === undefined ? 'Unavailable' : `AQI ${worst.averageAqi}`,
      note: worst
        ? 'Highest hourly model reading today'
        : 'The hourly series is too incomplete to pick a window',
      tone: 'higher',
      icon: Moon,
    },
  ]

  return (
    <section aria-labelledby="day-timeline-heading">
      <div className="section-heading timeline-heading">
        <div>
          <p className="eyebrow">WHAT HAPPENS TODAY</p>
          <h2 id="day-timeline-heading">Plan around these three moments</h2>
        </div>
        <p className="timeline-note">Windows come from the hourly model series, not official station observations.</p>
      </div>
      <ol className="day-events">
        {moments.map(({ key, label, time, aqi, note, tone, icon: Icon }) => (
          <li key={key} className={`event-card ${tone}`}>
            <span className="event-icon"><Icon size={16} aria-hidden="true" /></span>
            <small>{label}</small>
            <strong>{time}</strong>
            <span className="event-aqi">{aqi}</span>
            <span className="event-note">{note}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

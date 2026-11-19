import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DayTimeline } from './DayTimeline'
import type { AqiAssessment } from '../types'

const assessment: AqiAssessment = {
  aqi: 214,
  category: 'Poor',
  status: 'ok',
  reason: null,
  validPollutants: 6,
  requiredPollutants: 3,
  hasParticulate: true,
  pollutants: [],
  beyondScale: false,
}

describe('DayTimeline', () => {
  it('shows the three decision points with the planner windows', () => {
    render(
      <DayTimeline
        assessment={assessment}
        best={{ start: '04:00', end: '06:00', averageAqi: 120, averagePm25: 55 }}
        worst={{ start: '18:00', end: '20:00', averageAqi: 260, averagePm25: 140 }}
      />,
    )
    expect(screen.getByText('Now')).toBeInTheDocument()
    expect(screen.getByText('AQI 214')).toBeInTheDocument()
    expect(screen.getByText('04:00–06:00')).toBeInTheDocument()
    expect(screen.getByText('AQI 120')).toBeInTheDocument()
    expect(screen.getByText('18:00–20:00')).toBeInTheDocument()
    expect(screen.getByText('AQI 260')).toBeInTheDocument()
  })

  it('says a window is unavailable instead of inventing a time', () => {
    render(<DayTimeline assessment={null} best={null} worst={null} />)
    expect(screen.getAllByText('Unavailable').length).toBe(3)
    expect(screen.getAllByText('Not identified').length).toBe(2)
    expect(screen.getByText('No overall index for this hour')).toBeInTheDocument()
  })

  it('does not claim a window average the planner could not compute', () => {
    render(
      <DayTimeline
        assessment={assessment}
        best={{ start: '04:00', end: '06:00', averageAqi: null, averagePm25: null }}
        worst={null}
      />,
    )
    expect(screen.getAllByText('Unavailable').length).toBe(2)
    expect(screen.getByText('04:00–06:00')).toBeInTheDocument()
  })
})

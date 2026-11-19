import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const airPayload = {
  current: {
    time: '2026-11-18T10:30',
    pm2_5: 90,
    pm10: 100,
    nitrogen_dioxide: 40,
    sulphur_dioxide: 20,
    carbon_monoxide: 700,
    ozone: 30,
    ammonia: 50,
  },
  hourly: {
    time: ['2026-11-18T10:00', '2026-11-18T11:00', '2026-11-18T12:00'],
    pm2_5: [90, 80, 70],
    pm10: [100, 100, 100],
    nitrogen_dioxide: [40, 40, 40],
    sulphur_dioxide: [20, 20, 20],
    carbon_monoxide: [700, 700, 700],
    ozone: [30, 30, 30],
    ammonia: [50, 50, 50],
  },
}

const weatherPayload = {
  current: {
    time: '2026-11-18T10:30',
    temperature_2m: 24,
    relative_humidity_2m: 55,
    wind_speed_10m: 8,
    weather_code: 2,
  },
}

beforeEach(() => {
  window.history.pushState({}, '', '/')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('air-quality-api')) {
        return new Response(JSON.stringify(airPayload), { status: 200 })
      }
      if (url.includes('/v1/forecast')) {
        return new Response(JSON.stringify(weatherPayload), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    }),
  )
})

describe('application integration', () => {
  it('allows onboarding number fields to be cleared while editing', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /^Next$/i }))
    const adults = await screen.findByLabelText(/Adults \(18–64\)/i)

    fireEvent.change(adults, { target: { value: '' } })
    expect(adults).toHaveValue(null)

    fireEvent.change(adults, { target: { value: '4' } })
    expect(adults).toHaveValue(4)
  })

  it('renders live model data without fake names or demo readings', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByText('200').length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText(/Moderate/).length).toBeGreaterThan(0)
    expect(screen.getByText(/not an official CPCB station reading/i)).toBeInTheDocument()
    expect(screen.queryByText('Ananya')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ask Vayu/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Set up your household plan/i })).toBeInTheDocument()
  })

  it('contains the main navigation routes', async () => {
    render(<App />)
    for (const label of ['Overview', 'Air quality', 'Daily planner', 'Indoor air', 'Impact simulator', 'Family protection', 'AI advisor']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  it('preserves assistant source labels and renders trusted source links', async () => {
    window.history.pushState({}, '', '/advisor')
    localStorage.setItem('vayu.onboarded.v1', 'true')
    const answers = [
      { source: 'fallback', answer: 'Fallback environmental guidance.', sources: ['OPEN_METEO_MODEL'] },
      { source: 'gemini', answer: 'Validated AI environmental guidance.', sources: ['CPCB_AQI_METHODOLOGY'] },
    ]
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/chat') return new Response(JSON.stringify(answers.shift()), { status: 200 })
      if (url.includes('air-quality-api')) return new Response(JSON.stringify(airPayload), { status: 200 })
      if (url.includes('/v1/forecast')) return new Response(JSON.stringify(weatherPayload), { status: 200 })
      return new Response('{}', { status: 404 })
    }))
    render(<App />)

    const input = await screen.findByRole('textbox', { name: 'Ask Vayu a question' })
    fireEvent.change(input, { target: { value: 'Should I run?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/chat', expect.any(Object)))
    expect(await screen.findByText(/estimated CPCB-style model AQI 200/)).toBeInTheDocument()
    // Every assistant fallback message carries the provenance label, including
    // the seeded opening message — the badge is no longer suppressed for index 0.
    expect(screen.getAllByText('Deterministic guidance').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Open-Meteo CAMS model' })).toHaveAttribute('href', 'https://open-meteo.com/en/docs/air-quality-api')

    fireEvent.change(input, { target: { value: 'When should I walk?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect(await screen.findByText('Validated AI environmental guidance.')).toBeInTheDocument()
    expect(screen.getByText('AI-assisted, checked against Vayu safety rules')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'CPCB National AQI methodology' }).every(link =>
      link.getAttribute('href') === 'https://airquality.cpcb.gov.in/ccr_docs/About_AQI.pdf',
    )).toBe(true)
  })

  it('shows sustainable alternatives without inventing kilogram savings', async () => {
    window.history.pushState({}, '', '/impact')
    render(<App />)

    const alternativesTab = await screen.findByRole('tab', { name: 'Sustainable alternatives' })
    fireEvent.click(alternativesTab)

    expect(await screen.findByRole('heading', { name: /Cleaner routines at home/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Collective action nearby/i })).toBeInTheDocument()

    // Household and community cards must decline to quote a number they cannot measure.
    expect(screen.getAllByText(/Not estimated/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Vayu does not invent tonnage/i)).toBeInTheDocument()

    // Transport cards are allowed to be numeric, but only with a labelled factor version.
    expect(screen.getAllByText(/vayu-planning-2026\.1/).length).toBeGreaterThan(0)
  })
})

import { useMemo, useState } from 'react'
import { TrendingDown } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { PageHeading } from '../components/PageHeading'
import { AlternativesPanel } from '../components/impact/AlternativesPanel'
import { ExposurePanel } from '../components/impact/ExposurePanel'
import { IndoorPanel } from '../components/impact/IndoorPanel'
import { TransportPanel } from '../components/impact/TransportPanel'
import { compareTransport, estimateCadr, exposureProxy, sumExposureProxy } from '../utils/impact'
import type { CommuteMode } from '../types'

type Tab = 'transport' | 'exposure' | 'indoor' | 'alternatives'

const TAB_ORDER: readonly Tab[] = ['transport', 'exposure', 'indoor', 'alternatives']

const TAB_LABELS: readonly { id: Tab; label: string }[] = [
  { id: 'transport', label: 'Transport' },
  { id: 'exposure', label: 'Outdoor exposure' },
  { id: 'indoor', label: 'Indoor improvements' },
  { id: 'alternatives', label: 'Sustainable alternatives' },
]

export default function ImpactSimulator() {
  const { profile, air, planner } = useApp()
  const [tab, setTab] = useState<Tab>('transport')
  const [distance, setDistance] = useState(profile.commuteDistanceKm || 10)
  const [days, setDays] = useState(5)
  const [alternative, setAlternative] = useState<CommuteMode>(
    profile.commute === 'Petrol car' ? 'Metro' : profile.commute,
  )
  const [occupancy, setOccupancy] = useState(2)
  const [hours, setHours] = useState(2)

  const comparison = useMemo(() => {
    try {
      return {
        value: compareTransport({ oneWayKm: distance, daysPerWeek: days, alternative, occupancy }),
        error: null,
      }
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : 'Invalid inputs' }
    }
  }, [distance, days, alternative, occupancy])

  const hourly = air.data?.model.hourly ?? []
  const bestIndex = planner.bestWindow ? Math.max(0, hourly.findIndex(point => point.label === planner.bestWindow?.start)) : 0
  const currentPm25 = hourly[0]?.pm25 ?? null
  const alternativePm25 = hourly[bestIndex]?.pm25 ?? null
  const baselineProxy = exposureProxy(currentPm25, hours)
  const alternativeProxy = exposureProxy(alternativePm25, hours)
  const proxyChange =
    baselineProxy !== null && alternativeProxy !== null && baselineProxy > 0
      ? Math.round(((alternativeProxy - baselineProxy) / baselineProxy) * 100)
      : null
  const windowProxy = sumExposureProxy(hourly, bestIndex, hours)
  const cadr = estimateCadr({ areaSqFt: profile.roomAreaSqFt, achLow: 4, achHigh: profile.children > 0 || profile.elderly > 0 ? 6 : 5 })
  const cleanerWindow = planner.bestWindow ? `${planner.bestWindow.start}–${planner.bestWindow.end}` : null

  return (
    <div className="page">
      <PageHeading
        eyebrow="WHAT-IF ANALYSIS"
        title="Impact simulator"
        description="Compare personal emissions and exposure proxies before changing a routine."
      />

      <div
        className="sim-tabs"
        role="tablist"
        aria-label="Impact scenarios"
        onKeyDown={event => {
          const index = TAB_ORDER.indexOf(tab)
          if (index === -1) return
          let next: Tab | null = null
          if (event.key === 'ArrowRight') next = TAB_ORDER[(index + 1) % TAB_ORDER.length] ?? null
          if (event.key === 'ArrowLeft') next = TAB_ORDER[(index - 1 + TAB_ORDER.length) % TAB_ORDER.length] ?? null
          if (event.key === 'Home') next = TAB_ORDER[0] ?? null
          if (event.key === 'End') next = TAB_ORDER[TAB_ORDER.length - 1] ?? null
          if (next === null) return
          event.preventDefault()
          setTab(next)
          document.getElementById(`tab-${next}`)?.focus()
        }}
      >
        {TAB_LABELS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'transport' && (
        <TransportPanel
          distance={distance}
          days={days}
          alternative={alternative}
          occupancy={occupancy}
          comparison={comparison}
          onDistanceChange={setDistance}
          onDaysChange={setDays}
          onAlternativeChange={setAlternative}
          onOccupancyChange={setOccupancy}
        />
      )}

      {tab === 'exposure' && (
        <ExposurePanel
          hours={hours}
          currentPm25={currentPm25}
          alternativePm25={alternativePm25}
          baselineProxy={baselineProxy}
          alternativeProxy={alternativeProxy}
          proxyChange={proxyChange}
          windowProxy={windowProxy}
          cleanerWindow={cleanerWindow}
          onHoursChange={setHours}
        />
      )}

      {tab === 'indoor' && <IndoorPanel profile={profile} cadr={cadr} />}

      {tab === 'alternatives' && (
        <AlternativesPanel
          distance={distance}
          days={days}
          occupancy={occupancy}
          profile={profile}
          onAdjustTransport={() => setTab('transport')}
        />
      )}

      <p className="page-footnote">
        <TrendingDown size={14} aria-hidden="true" /> Personal emissions, outdoor concentration and personal exposure
        are different quantities. Vayu keeps them separate.
      </p>
    </div>
  )
}

import { useState } from 'react'
import { Check, ChevronDown, RefreshCw, Sparkles } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { recommendationTitle } from '../services/recommendationService'
import { requestAiBrief } from '../services/planService'
import type { AiBrief } from '../types'
import { formatRelativeTime } from '../utils/date'
import { SOURCE_METADATA } from '../constants/sources'

export default function DailyPlanner() {
  const { planner, air, profile, checklist, toggleChecklistItem, refresh, location } = useApp()
  const [brief, setBrief] = useState<AiBrief | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)

  const completed = planner.recommendations.filter(item => checklist.includes(item.id)).length
  const total = planner.recommendations.length
  const progress = total === 0 ? 0 : (completed / total) * 100

  const generateBrief = async () => {
    setBriefLoading(true)
    refresh()
    const assessment = air.data?.model.assessment
    const result = await requestAiBrief({
      context: {
        city: location.city,
        aqi: assessment?.aqi ?? null,
        category: assessment?.category ?? null,
        pm25: assessment?.pollutants.find(item => item.key === 'pm25')?.value ?? null,
        bestWindow: planner.bestWindow ? `${planner.bestWindow.start}–${planner.bestWindow.end}` : null,
        worstWindow: planner.worstWindow ? `${planner.worstWindow.start}–${planner.worstWindow.end}` : null,
        profile,
      },
      profile,
      planner,
    })
    setBrief(result)
    setBriefLoading(false)
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PERSONALIZED ROUTINE</p>
          <h1>Daily planner</h1>
          <p>Actions adapted to the current model forecast and your saved household preferences.</p>
        </div>
        <button type="button" className="secondary-button" onClick={refresh} disabled={air.refreshing}>
          <RefreshCw size={16} className={air.refreshing ? 'spin' : ''} aria-hidden="true" />
          {air.refreshing ? 'Refreshing…' : 'Refresh data'}
        </button>
      </div>

      {/* The deterministic plan is the product. It comes first; the AI brief is
          optional wording on top of it and sits further down the page. */}
      <section className="plan-summary" aria-labelledby="plan-summary-heading">
        <div className="plan-summary-main">
          <p className="eyebrow">TODAY&apos;S PLAN</p>
          <h2 id="plan-summary-heading">
            {total === 0
              ? 'No actions are generated until provider data is usable'
              : completed === total
                ? `All ${total} actions done for today`
                : `${completed} of ${total} actions done`}
          </h2>
          <p>{planner.contextSummary}</p>
          <div className="plan-progress-track" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
        <dl className="plan-summary-windows">
          <div>
            <dt>Cleaner window</dt>
            <dd>{planner.bestWindow ? `${planner.bestWindow.start}–${planner.bestWindow.end}` : 'Unavailable'}</dd>
          </div>
          <div>
            <dt>Higher-pollution window</dt>
            <dd>{planner.worstWindow ? `${planner.worstWindow.start}–${planner.worstWindow.end}` : 'Unavailable'}</dd>
          </div>
          <div>
            <dt>Plan generated</dt>
            <dd>{formatRelativeTime(planner.generatedAt)}</dd>
          </div>
        </dl>
      </section>

      <div className="planner-layout">
        <section className="timeline" aria-labelledby="actions-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR DAY</p>
              <h2 id="actions-heading">{planner.recommendations.length} recommended actions</h2>
            </div>
          </div>

          {total === 0 && (
            <p className="empty-copy" role="status">
              The forecast series is too incomplete to build a plan. Nothing is invented to fill the gap; refresh once
              provider data returns.
            </p>
          )}

          {planner.recommendations.map(item => {
            const checked = checklist.includes(item.id)
            return (
              <article className={`recommendation-card ${checked ? 'completed' : ''}`} key={item.id}>
                <div className="recommendation-header">
                  <div>
                    <span className="recommendation-category">{recommendationTitle(item.category)}</span>
                    <h3>{item.title}</h3>
                  </div>
                  <button
                    type="button"
                    className="timeline-check"
                    aria-label={`${checked ? 'Mark incomplete' : 'Mark complete'}: ${item.title}`}
                    aria-pressed={checked}
                    onClick={() => toggleChecklistItem(item.id)}
                  >
                    {checked ? <Check size={15} /> : null}
                  </button>
                </div>
                <p className="recommendation-action">{item.action}</p>
                <p className="recommendation-meta"><strong>When:</strong> {item.suggestedTime}</p>
                <div className="tag-row">
                  <span>{item.cost}</span>
                  <span>{item.effort} effort</span>
                  <span>{item.evidenceLevel} evidence</span>
                </div>
                <details>
                  <summary>Why this was recommended <ChevronDown size={14} aria-hidden="true" /></summary>
                  <div className="recommendation-details">
                    <p>{item.explanation}</p>
                    <p><strong>Environmental context:</strong> {item.environmentalContext}</p>
                    <p><strong>Who benefits:</strong> {item.beneficiaries.join(', ')}</p>
                    <p><strong>Expected benefit:</strong> {item.benefitType}</p>
                    <p><strong>Limitations:</strong> {item.limitations}</p>
                    <p><strong>Sources:</strong> {item.sources.join(' · ')}</p>
                  </div>
                </details>
              </article>
            )
          })}
        </section>

        <aside className="plan-aside">
          <div className="family-focus">
            <div className="insight-icon amber"><Sparkles size={20} aria-hidden="true" /></div>
            <small>HOUSEHOLD FOCUS</small>
            <h3>{profile.children > 0 ? 'Children and older adults' : profile.elderly > 0 ? 'Older adults' : 'Sensitive family members'}</h3>
            <p>
              Plan actions update automatically when the location, forecast or saved profile changes. Check the hourly
              table before relying on a window.
            </p>
          </div>
          <div className="plan-tip">
            <p><strong>Planning assumption</strong><br />Forecast windows are model estimates and can change quickly. Always recheck before outdoor activity.</p>
          </div>
          <p className="data-note">
            Saved tasks reset each local day. Preferences are stored in this browser only.
          </p>
        </aside>
      </div>

      {/* Optional AI wording on top of the plan above. Deliberately below it: the
          deterministic plan is authoritative even when Gemini is configured. */}
      <section className="brief-card" aria-labelledby="brief-heading">
        <div className="card-heading">
          <div>
            <small>OPTIONAL GEMINI BRIEF</small>
            <h2 id="brief-heading">AI daily brief</h2>
          </div>
          <button type="button" className="secondary-button" onClick={generateBrief} disabled={briefLoading}>
            <Sparkles size={16} aria-hidden="true" /> {briefLoading ? 'Working…' : brief ? 'Regenerate brief' : 'Generate brief'}
          </button>
        </div>
        {brief === null && (
          <p className="empty-copy">
            Add a short, validated explanation based on the same provider data. The plan above already works without
            it, and the AI never calculates AQI or emission numbers.
          </p>
        )}
        {brief?.source === 'unavailable' && (
          <p className="empty-copy" role="status">{brief.reason ?? 'AI brief is unavailable. The deterministic plan remains active.'}</p>
        )}
        {brief?.source === 'gemini' && (
          <>
            {brief.greeting && <p className="brief-greeting">{brief.greeting}</p>}
            <div className="brief-sections">
              {brief.sections.map(section => (
                <div key={section.title}>
                  <h3>{section.title}</h3>
                  <p>{section.guidance}</p>
                </div>
              ))}
            </div>
            {brief.sources.length > 0 && <p className="data-note">Sources: {brief.sources.map((id, index) => {
              const source = SOURCE_METADATA[id]
              return <span key={id}>{index > 0 ? ' · ' : ''}<a href={source.url} target={source.url.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{source.name}</a></span>
            })}</p>}
            <p className="data-note">AI explanations are validated for shape and length, but they are not a substitute for the deterministic plan or medical advice.</p>
          </>
        )}
      </section>
    </div>
  )
}

import type { SustainableAlternative } from '../../constants/alternatives'

/**
 * One qualitative household or community action. Every field comes from the
 * curated list in `constants/alternatives.ts`; nothing here is calculated, so a
 * card can never acquire an invented saving.
 */
export function AlternativeCard({ item }: { item: SustainableAlternative }) {
  return (
    <article className="alternative-card">
      <div className="alternative-head">
        <h3>{item.title}</h3>
        <span>{item.evidenceLevel} evidence</span>
      </div>
      <dl>
        <div><dt>Current behaviour</dt><dd>{item.currentBehaviour}</dd></div>
        <div><dt>Suggested alternative</dt><dd>{item.alternative}</dd></div>
        <div><dt>Cost difference</dt><dd>{item.cost}</dd></div>
        <div><dt>Practicality</dt><dd>{item.practicality}</dd></div>
        <div><dt>Environmental benefit</dt><dd>{item.environmentalBenefit}</dd></div>
        <div><dt>Estimated avoided emissions</dt><dd>{item.estimatedAvoidedEmissions}</dd></div>
      </dl>
      <p className="data-note"><strong>Method:</strong> {item.methodology}</p>
      <p className="data-note"><strong>Limitations:</strong> {item.limitations}</p>
      <p className="data-note"><strong>Sources:</strong> {item.sources.join(' · ')}</p>
    </article>
  )
}

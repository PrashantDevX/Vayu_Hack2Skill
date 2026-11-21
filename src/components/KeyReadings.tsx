import type { ReactNode } from 'react'

export interface KeyReading {
  label: string
  value: ReactNode
}

interface KeyReadingsProps {
  items: readonly KeyReading[]
  /** Accessible name for the list, e.g. "Key readings". */
  label: string
}

/**
 * The compact label/value chips used under a page's headline. Rendered as a
 * list so assistive technology announces the items as a set, and so a missing
 * value can be worded ("Unavailable") without collapsing the layout.
 */
export function KeyReadings({ items, label }: KeyReadingsProps) {
  return (
    <ul className="hero-chips" aria-label={label}>
      {items.map(item => (
        <li key={item.label}>
          <small>{item.label}</small>
          <strong>{item.value}</strong>
        </li>
      ))}
    </ul>
  )
}

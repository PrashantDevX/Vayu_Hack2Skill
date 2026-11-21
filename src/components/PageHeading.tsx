import type { ReactNode } from 'react'

interface PageHeadingProps {
  eyebrow: string
  title: string
  description: string
  /** Optional trailing control, e.g. a refresh button. */
  action?: ReactNode
}

/**
 * The single page-header layout. Every route uses the same eyebrow → title →
 * one-line purpose structure, so the visual hierarchy cannot drift page by page.
 */
export function PageHeading({ eyebrow, title, description, action }: PageHeadingProps) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

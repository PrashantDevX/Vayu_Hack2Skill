import { SOURCE_METADATA } from '../constants/sources'
import type { SourceId } from '../constants/sources'

interface SourceLinksProps {
  sources: readonly SourceId[]
  /** Text before the first link, e.g. "Sources: ". */
  prefix?: string
}

/**
 * Renders the trusted source list attached to an AI answer or daily brief.
 * Links only ever point at the registry in `constants/sources.ts`, so model
 * output can never introduce a URL.
 */
export function SourceLinks({ sources, prefix }: SourceLinksProps) {
  if (sources.length === 0) return null
  return (
    <span>
      {prefix}
      {sources.map((id, index) => {
        const source = SOURCE_METADATA[id]
        const external = source.url.startsWith('http')
        return (
          <span key={id}>
            {index > 0 ? ' · ' : ''}
            <a href={source.url} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
              {source.name}
            </a>
          </span>
        )
      })}
    </span>
  )
}

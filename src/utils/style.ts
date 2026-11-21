import type { CSSProperties } from 'react'

/**
 * CSS custom properties are valid style keys but are missing from React's
 * `CSSProperties` type. This helper is the one place that needs the cast, so
 * components can pass `style={cssVars({ '--progress': '42%' })}` without a
 * scattered `as React.CSSProperties` on every usage.
 */
export function cssVars(vars: Record<`--${string}`, string | number>): CSSProperties {
  return vars as CSSProperties
}

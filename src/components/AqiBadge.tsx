import { CATEGORY_CLASS } from '../constants/aqi'
import type { AqiCategory } from '../types'

interface AqiBadgeProps {
  aqi: number | null
  category: AqiCategory | null
  prefix?: string
}

export function AqiBadge({ aqi, category, prefix }: AqiBadgeProps) {
  if (aqi === null || category === null) {
    return (
      <span className="category-pill unavailable" role="status">
        AQI unavailable
      </span>
    )
  }

  return (
    <span className={`category-pill ${CATEGORY_CLASS[category]}`} role="status">
      {prefix ? `${prefix} ` : ''}
      {category} · {aqi}
    </span>
  )
}

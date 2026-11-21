import { AQI_SCALE_MAX } from '../constants/aqi'
import { cssVars } from '../utils/style'

/**
 * Half-dial showing the estimated AQI as a share of the 0–500 CPCB scale. It is
 * decorative: the numeric value is always printed next to it, so the gauge is
 * hidden from assistive technology instead of announcing a duplicate number.
 */
export function AqiGauge({ aqi }: { aqi: number | null }) {
  const progress = (Math.min(aqi ?? 0, AQI_SCALE_MAX) / AQI_SCALE_MAX) * 100
  return (
    <div className="aqi-gauge" aria-hidden="true">
      <div style={cssVars({ '--progress': `${progress}%` })} />
    </div>
  )
}

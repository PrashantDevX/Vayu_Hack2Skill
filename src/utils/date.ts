const MINUTE = 60_000
const HOUR = 3_600_000

export function formatRelativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return 'Unknown'
  const timestamp = new Date(iso).getTime()
  if (!Number.isFinite(timestamp)) return 'Unknown'
  const diff = Math.max(0, now - timestamp)
  if (diff < MINUTE) return 'Just now'
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE)
    return `${minutes} min ago`
  }
  if (diff < 24 * HOUR) {
    const hours = Math.floor(diff / HOUR)
    return `${hours} hr${hours === 1 ? '' : 's'} ago`
  }
  const days = Math.floor(diff / (24 * HOUR))
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Open-Meteo returns location-local ISO strings without an offset, so parsing
 * them with `new Date()` would shift them into the browser timezone. Slice the
 * label instead.
 */
export function formatHourLabel(localIso: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(localIso)
  if (match) return `${match[1]}:${match[2]}`
  if (/^\d{2}:\d{2}/.test(localIso)) return localIso.slice(0, 5)
  return localIso
}

export function formatObservedAt(iso: string | null): string {
  if (!iso) return 'Timestamp unavailable'
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

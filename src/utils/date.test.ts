import { describe, expect, it } from 'vitest'
import { formatHourLabel, formatObservedAt, formatRelativeTime, greetingForHour, localDateKey } from './date'

describe('relative time', () => {
  const now = new Date('2026-11-18T12:00:00.000Z').getTime()

  it('formats recent and older timestamps', () => {
    expect(formatRelativeTime(new Date(now - 20_000).toISOString(), now)).toBe('Just now')
    expect(formatRelativeTime(new Date(now - 5 * 60_000).toISOString(), now)).toBe('5 min ago')
    expect(formatRelativeTime(new Date(now - 2 * 3_600_000).toISOString(), now)).toBe('2 hrs ago')
    expect(formatRelativeTime(new Date(now - 3 * 24 * 3_600_000).toISOString(), now)).toBe('3 days ago')
  })

  it('handles missing or invalid timestamps', () => {
    expect(formatRelativeTime(null, now)).toBe('Unknown')
    expect(formatRelativeTime('not-a-date', now)).toBe('Unknown')
  })

  it('keeps future observations at just now and reports timestamp display fallbacks', () => {
    expect(formatRelativeTime(new Date(now + 60_000).toISOString(), now)).toBe('Just now')
    expect(formatObservedAt(null)).toBe('Timestamp unavailable')
    expect(formatObservedAt('invalid timestamp')).toBe('invalid timestamp')
  })
})

describe('local time handling', () => {
  it('formats Open-Meteo local ISO strings without timezone shifts', () => {
    expect(formatHourLabel('2026-11-18T14:00')).toBe('14:00')
    expect(formatHourLabel('14:00')).toBe('14:00')
    expect(formatHourLabel('unexpected')).toBe('unexpected')
  })

  it('creates a local calendar key', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(localDateKey(new Date(2026, 10, 18))).toBe('2026-11-18')
  })

  it('greets by hour', () => {
    expect(greetingForHour(8)).toBe('Good morning')
    expect(greetingForHour(14)).toBe('Good afternoon')
    expect(greetingForHour(20)).toBe('Good evening')
    expect(greetingForHour(0)).toBe('Good morning')
    expect(greetingForHour(16)).toBe('Good afternoon')
  })
})

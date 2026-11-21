import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A boolean that switches itself off after a delay, for "Saved" confirmations.
 * The timer is cleared on unmount and on each new trigger, so a page change can
 * never leave a pending state update behind.
 *
 * Returns the flag and a trigger function; the trigger is stable so it can be
 * used directly in an event handler.
 */
export function useTransientFlag(durationMs = 2500): [boolean, () => void] {
  const [active, setActive] = useState(false)
  const timer = useRef<number | null>(null)

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  useEffect(() => clear, [clear])

  const trigger = useCallback(() => {
    clear()
    setActive(true)
    timer.current = window.setTimeout(() => {
      timer.current = null
      setActive(false)
    }, durationMs)
  }, [clear, durationMs])

  return [active, trigger]
}

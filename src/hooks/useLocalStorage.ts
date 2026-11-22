import { useCallback, useEffect, useState } from 'react'

export function useLocalStorageState<T>(
  key: string,
  read: (raw: string | null) => T,
): [T, (value: T | ((previous: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      return read(window.localStorage.getItem(key))
    } catch {
      return read(null)
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage can be unavailable in private browsing; the app still works in memory.
    }
  }, [key, value])

  const update = useCallback((next: T | ((previous: T) => T)) => {
    setValue(next)
  }, [])

  return [value, update]
}

export function useBooleanLocalStorage(key: string, initial: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useLocalStorageState<boolean>(key, raw => {
    if (raw === null) return initial
    try {
      return JSON.parse(raw) === true
    } catch {
      return initial
    }
  })
  return [value, setValue]
}

import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close() {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}

if (typeof window !== 'undefined') {
  window.scrollTo = (() => undefined) as typeof window.scrollTo
}

afterEach(() => {
  cleanup()
  if (typeof window !== 'undefined') window.localStorage.clear()
  vi.unstubAllGlobals()
})

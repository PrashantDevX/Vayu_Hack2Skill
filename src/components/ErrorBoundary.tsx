import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep diagnostics out of the UI; never log household data or secrets.
    if (import.meta.env.DEV) console.error('Vayu render error', error.message, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-page" role="alert">
          <AlertTriangle size={32} aria-hidden="true" />
          <h1>Something went wrong</h1>
          <p>The page could not be rendered. Your saved preferences are still on this device.</p>
          <button type="button" className="primary-button" onClick={() => window.location.reload()}>
            Reload Vayu
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

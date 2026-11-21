import { RefreshCw } from 'lucide-react'

interface RefreshButtonProps {
  onClick: () => void
  refreshing: boolean
}

/**
 * Provider refresh is one action with one label. Keeping it in one component
 * stops the three data pages from drifting ("Refresh data" vs "Refresh plan")
 * and keeps the spinner accessible: the icon is decorative and the button text
 * announces the state change.
 */
export function RefreshButton({ onClick, refreshing }: RefreshButtonProps) {
  return (
    <button type="button" className="secondary-button" onClick={onClick} disabled={refreshing}>
      <RefreshCw size={16} className={refreshing ? 'spin' : ''} aria-hidden="true" />
      {refreshing ? 'Refreshing…' : 'Refresh data'}
    </button>
  )
}

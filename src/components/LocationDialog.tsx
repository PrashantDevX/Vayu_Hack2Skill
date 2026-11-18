import { Modal } from './Modal'
import { LocationSearch } from './LocationSearch'
import type { LocationState } from '../types'

interface LocationDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (location: LocationState) => void
}

export function LocationDialog({ open, onClose, onSelect }: LocationDialogProps) {
  return (
    <Modal open={open} onClose={onClose} eyebrow="Location" title="Change your location">
      <p className="dialog-copy">
        Search, use approximate browser location, or enter coordinates. Saved coordinates are rounded to about 1 km
        precision; exact GPS values are not retained.
      </p>
      <LocationSearch
        onSelect={location => {
          onSelect(location)
          onClose()
        }}
      />
    </Modal>
  )
}

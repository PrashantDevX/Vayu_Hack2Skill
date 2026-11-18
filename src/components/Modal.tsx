import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  children: ReactNode
  className?: string
}

export function Modal({ open, onClose, title, eyebrow, children, className = '' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`modal ${className}`.trim()}
      aria-labelledby={titleId}
      onCancel={event => {
        event.preventDefault()
        onClose()
      }}
      onClose={() => {
        if (open) onClose()
      }}
    >
      {open && (
        <>
          <div className="modal-heading">
            <div>
              {eyebrow && <small>{eyebrow}</small>}
              <h2 id={titleId}>{title}</h2>
            </div>
            <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          {children}
        </>
      )}
    </dialog>
  )
}

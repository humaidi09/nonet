// Modal + confirmation dialog. A single accessible primitive: focus moves in on
// open, Escape and backdrop-click close, background scroll locks, and focus is
// restored to the trigger on close. Used for pause, restart confirmation,
// completion, and data reset.

import { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button, cx } from './primitives'

export function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissable = true }) {
  const panelRef = useRef(null)
  const restoreRef = useRef(null)

  const close = useCallback(() => dismissable && onClose?.(), [dismissable, onClose])

  useEffect(() => {
    if (!open) return undefined
    restoreRef.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Move focus into the dialog.
    const t = setTimeout(() => {
      const focusable = panelRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      ;(focusable || panelRef.current)?.focus()
    }, 0)

    const onKey = (e) => {
      if (e.key === 'Escape') close()
      if (e.key === 'Tab') trapTab(e, panelRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [open, close])

  if (!open) return null

  const width = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' }[size]

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px] animate-fade-in"
        onClick={close}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          'relative w-full bg-surface border border-line shadow-2xl outline-none animate-pop-in',
          'rounded-t-2xl sm:rounded-2xl',
          width,
        )}
      >
        {(title || dismissable) && (
          <div className="flex items-start justify-between gap-4 p-5 pb-0">
            <div>
              {title && <h2 className="text-lg font-semibold leading-tight">{title}</h2>}
              {description && <p className="text-sm text-muted mt-1">{description}</p>}
            </div>
            {dismissable && (
              <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close" className="-mr-1 -mt-1">
                <X size={18} />
              </Button>
            )}
          </div>
        )}
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 pb-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

function trapTab(e, container) {
  if (!container) return
  const nodes = container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  if (!nodes.length) return
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

/** Confirmation dialog built on Modal — used for restart and reset-data. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm?.()
              onClose?.()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted leading-relaxed">{children}</p>
    </Modal>
  )
}

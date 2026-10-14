import { useEffect, type ReactNode } from 'react'
import type { ItemStatus } from '../demo/types'
import { Icon } from './Icon'

const STATUS_LABEL: Record<ItemStatus, string> = {
  submitted: 'Sent',
  preparing: 'Cooking',
  ready: 'Ready',
  served: 'Served',
  cancelled: 'Cancelled',
}

export function StatusBadge({ status }: { status: ItemStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>
}

export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-footer">{footer}</footer>}
      </div>
    </div>
  )
}

export function DemoBanner() {
  return (
    <div className="demo-banner">
      Frontend demo with mock data. No real orders or payments.
    </div>
  )
}

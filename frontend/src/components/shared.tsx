import { useEffect, type ReactNode } from 'react'
import type { ItemStatus } from '../demo/types'
import { DESIGNS, setDesign, useDesign } from './design'
import { Icon } from './Icon'

const STATUS_LABEL: Record<ItemStatus, string> = {
  submitted: 'Preparing',
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

/** Thin demo strip: what this is, and which design to show */
export function DemoBanner() {
  const design = useDesign()
  return (
    <div className="demo-banner">
      <span className="demo-banner-text">Demo for Ying Thai 2 · Stripe test mode, no real money moves</span>
      <span className="design-switch" role="radiogroup" aria-label="Design">
        <span className="design-switch-label">Design</span>
        {DESIGNS.map((d) => (
          <button
            key={d.id}
            role="radio"
            aria-checked={design === d.id}
            className={design === d.id ? 'active' : ''}
            title={d.note}
            onClick={() => setDesign(d.id)}
          >
            {d.name}
          </button>
        ))}
      </span>
    </div>
  )
}

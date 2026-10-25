// The floor plan: one area at a time on a grid of cells. The admin places tables and landmarks
// (Admin > Tables); front of house shows it read-only so staff find tables by where they are.
import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { FloorFixture } from '../demo/types'
import { FLOOR_COLS, FLOOR_ROWS, type Placed, type PlacedTable } from './floorLayout'
import './floor.css'

const box = (p: Placed) => ({
  left: `${(p.x / FLOOR_COLS) * 100}%`,
  top: `${(p.y / FLOOR_ROWS) * 100}%`,
  width: `${(p.w / FLOOR_COLS) * 100}%`,
  height: `${(p.h / FLOOR_ROWS) * 100}%`,
})

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export type FloorEdit = {
  selected: string | null
  onSelect: (key: string) => void
  /** Move a table (key "t:<index>") or landmark ("f:<index>") to a cell */
  onMove: (key: string, x: number, y: number) => void
}

type Props = {
  tables: (PlacedTable & { key: string })[]
  fixtures: (FloorFixture & { key: string })[]
  /** What a table shows, and its extra classes (state colours) */
  renderTable: (t: PlacedTable) => ReactNode
  tableClass?: (t: PlacedTable) => string
  tableLabel?: (t: PlacedTable) => string
  onTableClick?: (t: PlacedTable) => void
  /** Admin only: drag things to move them; arrow keys move the selected one a cell */
  edit?: FloorEdit
}

export function FloorPlan({ tables, fixtures, renderTable, tableClass, tableLabel, onTableClick, edit }: Props) {
  const canvas = useRef<HTMLDivElement>(null)
  const drag = useRef<{ key: string; px: number; py: number; x: number; y: number; w: number; h: number; moved: boolean } | null>(null)

  const startDrag = (e: PointerEvent, key: string, p: Placed) => {
    if (!edit) return
    edit.onSelect(key)
    drag.current = { key, px: e.clientX, py: e.clientY, x: p.x, y: p.y, w: p.w, h: p.h, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const moveDrag = (e: PointerEvent) => {
    const d = drag.current
    const rect = canvas.current?.getBoundingClientRect()
    if (!edit || !d || !rect) return
    const dx = Math.round((e.clientX - d.px) / (rect.width / FLOOR_COLS))
    const dy = Math.round((e.clientY - d.py) / (rect.height / FLOOR_ROWS))
    if (dx || dy) d.moved = true
    edit.onMove(d.key, clamp(d.x + dx, 0, FLOOR_COLS - d.w), clamp(d.y + dy, 0, FLOOR_ROWS - d.h))
  }
  const endDrag = () => {
    drag.current = null
  }
  const nudge = (e: KeyboardEvent, key: string, p: Placed) => {
    if (!edit) return
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (!step) return
    e.preventDefault()
    edit.onMove(key, clamp(p.x + step[0], 0, FLOOR_COLS - p.w), clamp(p.y + step[1], 0, FLOOR_ROWS - p.h))
  }

  // On a phone the plan keeps a readable size and scrolls sideways inside its box
  return (
    <div className="floor-scroll">
      <div ref={canvas} className={`floor ${edit ? 'floor-editing' : ''}`}>
        {fixtures.map((f) => (
          <div
            key={f.key}
            className={`floor-fixture ${f.h >= f.w * 3 ? 'tall' : ''} ${edit?.selected === f.key ? 'selected' : ''}`}
            style={box(f)}
            onPointerDown={edit ? (e) => startDrag(e, f.key, f) : undefined}
            onPointerMove={edit ? moveDrag : undefined}
            onPointerUp={edit ? endDrag : undefined}
            onKeyDown={edit ? (e) => nudge(e, f.key, f) : undefined}
            tabIndex={edit ? 0 : undefined}
            role={edit ? 'button' : undefined}
            aria-label={edit ? `Landmark ${f.label}` : undefined}
          >
            <span>{f.label}</span>
          </div>
        ))}
        {tables.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`floor-table shape-${t.shape} ${tableClass?.(t) ?? ''} ${edit?.selected === t.key ? 'selected' : ''}`}
            style={box(t)}
            aria-label={tableLabel?.(t) ?? `Table ${t.number}`}
            onPointerDown={edit ? (e) => startDrag(e, t.key, t) : undefined}
            onPointerMove={edit ? moveDrag : undefined}
            onPointerUp={edit ? endDrag : undefined}
            onKeyDown={edit ? (e) => nudge(e, t.key, t) : undefined}
            onClick={edit ? () => edit.onSelect(t.key) : () => onTableClick?.(t)}
          >
            {renderTable(t)}
          </button>
        ))}
      </div>
    </div>
  )
}

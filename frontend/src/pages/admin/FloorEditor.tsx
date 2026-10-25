// Admin > Tables: the admin draws the floor plan; front of house shows it read-only.
import { useEffect, useMemo, useState } from 'react'
import { FloorPlan } from '../../components/FloorPlan'
import { areasOf, FLOOR_COLS, FLOOR_ROWS, freeSpot, placeTables, type PlacedTable } from '../../components/floorLayout'
import { Icon } from '../../components/Icon'
import { actions } from '../../demo/store'
import type { DemoState, FloorFixture, TableShape } from '../../demo/types'

type DraftTable = Omit<PlacedTable, 'id'> & { id?: string }
type Draft = { tables: DraftTable[]; fixtures: FloorFixture[] }

const fromState = (demo: DemoState): Draft => ({
  tables: placeTables(demo.tables, demo.fixtures).map((t) => ({ ...t })),
  fixtures: demo.fixtures.map((f) => ({ ...f })),
})

export default function FloorEditor({ demo, flash }: { demo: DemoState; flash: (text: string) => void }) {
  const [draft, setDraft] = useState<Draft>(() => fromState(demo))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [extraAreas, setExtraAreas] = useState<string[]>([])
  const areas = useMemo(() => {
    const list = areasOf(draft.tables as PlacedTable[], draft.fixtures)
    for (const a of extraAreas) if (!list.includes(a)) list.push(a)
    return list.length ? list : ['Main']
  }, [draft, extraAreas])
  const [area, setArea] = useState(areas[0])
  const [selected, setSelected] = useState<string | null>(null)
  const current = areas.includes(area) ? area : areas[0]

  // Live updates from other devices refresh the plan, but never over unsaved changes
  useEffect(() => {
    if (!dirty) setDraft(fromState(demo))
  }, [demo, dirty])

  const change = (next: Draft) => {
    setDraft(next)
    setDirty(true)
  }
  const updateTable = (i: number, patch: Partial<DraftTable>) => change({ ...draft, tables: draft.tables.map((t, j) => (j === i ? { ...t, ...patch } : t)) })
  const updateFixture = (i: number, patch: Partial<FloorFixture>) =>
    change({ ...draft, fixtures: draft.fixtures.map((f, j) => (j === i ? { ...f, ...patch } : f)) })

  const inArea = (zone: string) => [...draft.tables.filter((t) => t.zone === zone), ...draft.fixtures.filter((f) => f.zone === zone)]

  const addTable = () => {
    const number = Math.max(0, ...draft.tables.map((t) => t.number)) + 1
    const spot = freeSpot(inArea(current), 2, 2)
    change({ ...draft, tables: [...draft.tables, { number, seats: 4, zone: current, ...spot, w: 2, h: 2, shape: 'square' }] })
    setSelected(`t:${draft.tables.length}`)
  }
  const addFixture = () => {
    const spot = freeSpot(inArea(current), 3, 1)
    change({ ...draft, fixtures: [...draft.fixtures, { label: 'Counter', zone: current, ...spot, w: 3, h: 1 }] })
    setSelected(`f:${draft.fixtures.length}`)
  }
  const addArea = () => {
    const name = window.prompt('Name of the new area (e.g. Upstairs, Outside)')?.trim()
    if (!name) return
    setExtraAreas((a) => [...a, name])
    setArea(name)
    setSelected(null)
  }
  const onMove = (key: string, x: number, y: number) => {
    const [kind, index] = [key[0], Number(key.slice(2))]
    if (kind === 't') updateTable(index, { x, y })
    else updateFixture(index, { x, y })
  }

  const save = async () => {
    setSaving(true)
    const ok = await actions.saveFloor(draft.tables, draft.fixtures)
    setSaving(false)
    if (ok) {
      setDirty(false)
      setExtraAreas([])
      flash('Floor plan saved')
    }
  }
  const discard = () => {
    setDraft(fromState(demo))
    setDirty(false)
    setExtraAreas([])
    setSelected(null)
  }

  const numberTaken = (i: number, n: number) => draft.tables.some((t, j) => j !== i && t.number === n)
  const sel = selected?.startsWith('t:') ? Number(selected.slice(2)) : null
  const selFixture = selected?.startsWith('f:') ? Number(selected.slice(2)) : null
  const table = sel != null ? draft.tables[sel] : null
  const fixture = selFixture != null ? draft.fixtures[selFixture] : null
  const duplicate = draft.tables.some((t, i) => numberTaken(i, t.number))

  return (
    <div className="floor-editor">
      <div className="admin-head">
        <div>
          <h1>Floor plan</h1>
          <p className="muted small">Place the tables as they are in the restaurant. Front of house sees this plan; only admins can change it.</p>
        </div>
        <div className="row gap wrap">
          {dirty && (
            <button className="btn btn-ghost" onClick={discard} disabled={saving}>
              Discard changes
            </button>
          )}
          <button className="btn btn-primary" onClick={save} disabled={!dirty || saving || duplicate}>
            {saving ? 'Saving…' : dirty ? 'Save floor plan' : 'Saved'}
          </button>
        </div>
      </div>

      <div className="row between wrap floor-editor-bar">
        <div className="floor-areas" role="tablist" aria-label="Areas">
          {areas.map((a) => (
            <button key={a} role="tab" aria-selected={a === current} className={a === current ? 'active' : ''} onClick={() => {
                setArea(a)
                setSelected(null)
              }}>
              {a}
            </button>
          ))}
          <button onClick={addArea}>
            <Icon name="plus" size={14} /> Area
          </button>
        </div>
        <div className="row gap">
          <button className="btn btn-outline btn-sm" onClick={addTable}>
            <Icon name="plus" size={15} /> Table
          </button>
          <button className="btn btn-outline btn-sm" onClick={addFixture}>
            <Icon name="plus" size={15} /> Landmark
          </button>
        </div>
      </div>

      <div className="floor-editor-body">
        <FloorPlan
          tables={draft.tables.flatMap((t, i) => (t.zone === current ? [{ ...(t as PlacedTable), key: `t:${i}` }] : []))}
          fixtures={draft.fixtures.flatMap((f, i) => (f.zone === current ? [{ ...f, key: `f:${i}` }] : []))}
          renderTable={(t) => (
            <>
              <span className="floor-number">{t.number}</span>
              <span className="floor-sub">{t.seats} seats</span>
            </>
          )}
          edit={{ selected, onSelect: setSelected, onMove }}
        />

        <aside className="card floor-panel" aria-label="Selected">
          {table && sel != null ? (
            <>
              <h3>Table {table.number}</h3>
              <label className="field">
                <span>Number</span>
                <input type="number" min={1} max={9999} value={table.number} onChange={(e) => updateTable(sel, { number: Number(e.target.value) || 1 })} />
              </label>
              {numberTaken(sel, table.number) && <p className="small floor-error">Another table already has this number.</p>}
              <label className="field">
                <span>Seats</span>
                <input type="number" min={1} max={50} value={table.seats} onChange={(e) => updateTable(sel, { seats: Math.max(1, Number(e.target.value) || 1) })} />
              </label>
              <AreaField value={table.zone} areas={areas} onChange={(zone) => {
                  updateTable(sel, { zone })
                  setArea(zone)
                }} />
              <div className="field">
                <span>Shape</span>
                <div className="segmented">
                  {(['square', 'round'] as TableShape[]).map((s) => (
                    <button key={s} className={table.shape === s ? 'active' : ''} onClick={() => updateTable(sel, { shape: s })}>
                      {s === 'square' ? 'Square' : 'Round'}
                    </button>
                  ))}
                </div>
              </div>
              <SizeField w={table.w} h={table.h} x={table.x} y={table.y} onChange={(w, h) => updateTable(sel, { w, h })} />
              <button
                className="btn btn-ghost btn-sm floor-remove"
                onClick={() => {
                  change({ ...draft, tables: draft.tables.filter((_, i) => i !== sel) })
                  setSelected(null)
                }}
              >
                Remove table
              </button>
              <p className="muted small">A table with past visits can't be removed; saving says so.</p>
            </>
          ) : fixture && selFixture != null ? (
            <>
              <h3>Landmark</h3>
              <label className="field">
                <span>Label</span>
                <input maxLength={40} value={fixture.label} onChange={(e) => updateFixture(selFixture, { label: e.target.value })} />
              </label>
              <AreaField value={fixture.zone} areas={areas} onChange={(zone) => {
                  updateFixture(selFixture, { zone })
                  setArea(zone)
                }} />
              <SizeField w={fixture.w} h={fixture.h} x={fixture.x} y={fixture.y} onChange={(w, h) => updateFixture(selFixture, { w, h })} />
              <button
                className="btn btn-ghost btn-sm floor-remove"
                onClick={() => {
                  change({ ...draft, fixtures: draft.fixtures.filter((_, i) => i !== selFixture) })
                  setSelected(null)
                }}
              >
                Remove landmark
              </button>
            </>
          ) : (
            <p className="muted small">
              Drag a table or landmark to move it, or select it to change it. Arrow keys move the selected one. Landmarks like the counter or the door help
              staff find tables.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

function AreaField({ value, areas, onChange }: { value: string; areas: string[]; onChange: (zone: string) => void }) {
  return (
    <label className="field">
      <span>Area</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {areas.map((a) => (
          <option key={a}>{a}</option>
        ))}
      </select>
    </label>
  )
}

/** Width and height in cells, kept inside the plan */
function SizeField({ w, h, x, y, onChange }: { w: number; h: number; x: number; y: number; onChange: (w: number, h: number) => void }) {
  const step = (dw: number, dh: number) => onChange(Math.max(1, Math.min(FLOOR_COLS - x, w + dw)), Math.max(1, Math.min(FLOOR_ROWS - y, h + dh)))
  return (
    <div className="field">
      <span>Size (cells)</span>
      <div className="floor-size">
        <span className="muted small">Wide</span>
        <button className="icon-btn" aria-label="Narrower" onClick={() => step(-1, 0)}>
          <Icon name="minus" size={14} />
        </button>
        <strong>{w}</strong>
        <button className="icon-btn" aria-label="Wider" onClick={() => step(1, 0)}>
          <Icon name="plus" size={14} />
        </button>
        <span className="muted small">Deep</span>
        <button className="icon-btn" aria-label="Shallower" onClick={() => step(0, -1)}>
          <Icon name="minus" size={14} />
        </button>
        <strong>{h}</strong>
        <button className="icon-btn" aria-label="Deeper" onClick={() => step(0, 1)}>
          <Icon name="plus" size={14} />
        </button>
      </div>
    </div>
  )
}

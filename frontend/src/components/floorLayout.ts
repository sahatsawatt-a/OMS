// Floor plan layout helpers, shared by the admin editor and front of house (FloorPlan.tsx)
import type { FloorFixture, Table } from '../demo/types'

// Same grid as the backend (app/schemas.py FLOOR_COLS / FLOOR_ROWS)
export const FLOOR_COLS = 24
export const FLOOR_ROWS = 16

export type Placed = { x: number; y: number; w: number; h: number }
export type PlacedTable = Table & Placed

/** Areas in a stable order: as tables are numbered, then any that only have landmarks */
export function areasOf(tables: Table[], fixtures: FloorFixture[]): string[] {
  const areas: string[] = []
  for (const t of [...tables].sort((a, b) => a.number - b.number)) if (!areas.includes(t.zone)) areas.push(t.zone)
  for (const f of fixtures) if (!areas.includes(f.zone)) areas.push(f.zone)
  return areas
}

const overlaps = (a: Placed, b: Placed) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** A free spot of this size in an area, left to right, top to bottom (or the top left if full) */
export function freeSpot(taken: Placed[], w: number, h: number): { x: number; y: number } {
  for (let y = 1; y + h <= FLOOR_ROWS; y += 1) {
    for (let x = 1; x + w <= FLOOR_COLS; x += 1) {
      const spot = { x, y, w: w + 1, h: h + 1 }
      if (!taken.some((t) => overlaps(spot, { ...t, w: t.w + 1, h: t.h + 1 }))) return { x, y }
    }
  }
  return { x: 0, y: 0 }
}

/** Every table with a position: the ones the admin hasn't placed yet get a free spot in their area */
export function placeTables(tables: Table[], fixtures: FloorFixture[]): PlacedTable[] {
  const placed: PlacedTable[] = []
  const later: Table[] = []
  for (const t of tables) {
    if (t.x == null || t.y == null) later.push(t)
    else placed.push({ ...t, x: t.x, y: t.y })
  }
  for (const t of [...later].sort((a, b) => a.number - b.number)) {
    const taken = [...placed.filter((p) => p.zone === t.zone), ...fixtures.filter((f) => f.zone === t.zone)]
    placed.push({ ...t, ...freeSpot(taken, t.w, t.h) })
  }
  return placed
}

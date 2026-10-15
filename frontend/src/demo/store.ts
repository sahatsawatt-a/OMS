// Mock "backend" for the frontend demo.
// State lives in localStorage so Staff, Kitchen and Customer tabs in the same browser
// stay in sync live (via the `storage` event). Replace these actions with API calls later.
import { useSyncExternalStore } from 'react'
import { randomToken, shortId } from './ids'
import { defaultMenu, TABLES } from './mockData'
import { emptyState, seedState } from './seed'
import type { CartLine, DemoState, ItemStatus, MenuItem, PaymentMethod, TableSession } from './types'

// Bump when stored data changes meaning: v3 = prices in AUD cents (v2 held THB satang)
const STORAGE_KEY = 'oms-demo-v3'

export { randomToken }

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as DemoState
      // Data saved before the menu became editable has no menu yet
      saved.menu ??= defaultMenu()
      return saved
    }
  } catch {
    // Storage unavailable or corrupt: fall back to a fresh demo
  }
  // Persist the seed straight away, otherwise every reload would mint new session tokens
  const seeded = seedState()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
  } catch {
    // Storage blocked: the demo still works within this page
  }
  return seeded
}

let state = load()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

/** Apply a change; returns false when the browser refused to save it (e.g. storage full) */
function update(mutate: (draft: DemoState) => void): boolean {
  const next = structuredClone(state)
  mutate(next)
  state = next
  let saved = true
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Keep working in memory if storage is blocked or full
    saved = false
  }
  emit()
  return saved
}

window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY || e.key === null) {
    state = load()
    emit()
  }
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useDemoState(): DemoState {
  return useSyncExternalStore(subscribe, () => state)
}

// Allowed item status changes (REQ-22)
const NEXT_STATUS: Record<ItemStatus, ItemStatus[]> = {
  submitted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served'],
  served: [],
  cancelled: [],
}

export function canMoveTo(from: ItemStatus, to: ItemStatus): boolean {
  return NEXT_STATUS[from].includes(to)
}

export function openSessionFor(tableNumber: number): TableSession | undefined {
  return Object.values(state.sessions).find((s) => s.tableNumber === tableNumber && s.status === 'open')
}

export const actions = {
  openSession(tableId: string, guests: number, token = randomToken()): TableSession {
    const table = TABLES.find((t) => t.id === tableId)
    if (!table) throw new Error(`Unknown table ${tableId}`)
    const existing = openSessionFor(table.number)
    if (existing) return existing
    const session: TableSession = {
      token,
      tableId,
      tableNumber: table.number,
      guests,
      status: 'open',
      openedAt: Date.now(),
    }
    update((d) => {
      d.sessions[token] = session
    })
    return session
  },

  submitOrder(sessionToken: string, lines: CartLine[]) {
    update((d) => {
      const session = d.sessions[sessionToken]
      if (!session || session.status !== 'open' || lines.length === 0) return
      const round = d.orders.filter((o) => o.sessionToken === sessionToken).length + 1
      d.orders.push({
        id: shortId(),
        sessionToken,
        tableNumber: session.tableNumber,
        round,
        createdAt: Date.now(),
        items: lines
          .filter((l) => !d.soldOut.includes(l.menuItemId) && !d.menu.items.find((m) => m.id === l.menuItemId)?.hidden)
          .map((l) => ({
            id: shortId(),
            menuItemId: l.menuItemId,
            name: l.name,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            options: l.options,
            note: l.note,
            status: 'submitted' as const,
          })),
      })
    })
  },

  setItemStatus(orderId: string, itemId: string, to: ItemStatus) {
    update((d) => {
      const item = d.orders.find((o) => o.id === orderId)?.items.find((i) => i.id === itemId)
      if (item && canMoveTo(item.status, to)) item.status = to
    })
  },

  advanceOrder(orderId: string, from: ItemStatus, to: ItemStatus) {
    update((d) => {
      const order = d.orders.find((o) => o.id === orderId)
      order?.items.forEach((i) => {
        if (i.status === from && canMoveTo(from, to)) i.status = to
      })
    })
  },

  callWaiter(sessionToken: string) {
    update((d) => {
      const s = d.sessions[sessionToken]
      if (s?.status === 'open') s.waiterCalledAt = Date.now()
    })
  },

  requestBill(sessionToken: string) {
    update((d) => {
      const s = d.sessions[sessionToken]
      if (s?.status === 'open') s.billRequestedAt = Date.now()
    })
  },

  acknowledge(sessionToken: string, alert: 'waiter' | 'bill') {
    update((d) => {
      const s = d.sessions[sessionToken]
      if (!s) return
      if (alert === 'waiter') delete s.waiterCalledAt
      else delete s.billRequestedAt
    })
  },

  settle(sessionToken: string, method: PaymentMethod, amount: number) {
    update((d) => {
      const s = d.sessions[sessionToken]
      if (!s || s.status !== 'open') return
      s.payment = { method, amount, paidAt: Date.now() }
      s.status = 'closed'
      s.closedAt = Date.now()
      delete s.waiterCalledAt
      delete s.billRequestedAt
    })
  },

  toggleSoldOut(menuItemId: string) {
    update((d) => {
      d.soldOut = d.soldOut.includes(menuItemId)
        ? d.soldOut.filter((id) => id !== menuItemId)
        : [...d.soldOut, menuItemId]
    })
  },

  /** Back to the sample tables and orders; the menu (and admin edits to it) is kept */
  reset() {
    update((d) => {
      Object.assign(d, { ...seedState(), menu: d.menu })
    })
  },

  /** No tables seated, no orders; the menu is kept */
  clear() {
    update((d) => {
      Object.assign(d, { ...emptyState(), menu: d.menu })
    })
  },

  // ---- Menu admin ----

  /** Add a dish or replace the one with the same id */
  saveMenuItem(item: MenuItem): boolean {
    return update((d) => {
      const i = d.menu.items.findIndex((m) => m.id === item.id)
      if (i >= 0) d.menu.items[i] = item
      else d.menu.items.push(item)
    })
  },

  setMenuItemHidden(id: string, hidden: boolean) {
    update((d) => {
      const item = d.menu.items.find((m) => m.id === id)
      if (item) item.hidden = hidden
    })
  },

  /** Only dishes that were never ordered can be deleted; others are hidden instead */
  deleteMenuItem(id: string): boolean {
    if (state.orders.some((o) => o.items.some((i) => i.menuItemId === id))) return false
    return update((d) => {
      d.menu.items = d.menu.items.filter((m) => m.id !== id)
      d.soldOut = d.soldOut.filter((s) => s !== id)
    })
  },

  addCategory(name: string): string {
    const id = `${slug(name) || 'category'}-${shortId().slice(0, 4).toLowerCase()}`
    update((d) => {
      d.menu.categories.push({ id, name })
    })
    return id
  },

  renameCategory(id: string, name: string) {
    update((d) => {
      const c = d.menu.categories.find((x) => x.id === id)
      if (c) c.name = name
    })
  },

  moveCategory(id: string, delta: -1 | 1) {
    update((d) => {
      const list = d.menu.categories
      const i = list.findIndex((c) => c.id === id)
      const j = i + delta
      if (i < 0 || j < 0 || j >= list.length) return
      ;[list[i], list[j]] = [list[j], list[i]]
    })
  },

  /** Only empty categories can be deleted */
  deleteCategory(id: string): boolean {
    if (state.menu.items.some((m) => m.categoryId === id)) return false
    return update((d) => {
      d.menu.categories = d.menu.categories.filter((c) => c.id !== id)
    })
  },

  /** Put the sample menu back (sold-out marks are cleared too) */
  resetMenu() {
    update((d) => {
      d.menu = defaultMenu()
      d.soldOut = []
    })
  },
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/** A new, unique dish id based on its name */
export function newMenuItemId(name: string): string {
  return `${slug(name) || 'dish'}-${shortId().slice(0, 4).toLowerCase()}`
}

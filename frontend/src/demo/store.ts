// Mock "backend" for the frontend demo.
// State lives in localStorage so Staff, Kitchen and Customer tabs in the same browser
// stay in sync live (via the `storage` event). Replace these actions with API calls later.
// The menu already comes from the real backend when it is running (see "Menu from the
// backend" below); tables, orders and payments are still browser-only.
import { useSyncExternalStore } from 'react'
import { api, ApiError } from '../lib/api'
import { randomToken, shortId } from './ids'
import { defaultMenu, TABLES } from './mockData'
import { emptyState, seedState } from './seed'
import type {
  Allergen,
  CartLine,
  DemoState,
  DietaryTag,
  ItemStatus,
  MenuCategory,
  MenuData,
  MenuItem,
  OptionGroup,
  PaymentMethod,
  TableSession,
} from './types'

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

// ---- Menu from the backend ----
// When the API answers, the menu is loaded from MySQL and admin edits are saved there, so
// every device shows the same menu (checked again every few seconds). When it doesn't,
// e.g. `npm run dev` without the backend, the menu stays in this browser as before.

type ServerItem = {
  id: string
  categoryId: string
  name: string
  description: string
  price: number
  image: string | null
  recommended: boolean
  optionGroups: OptionGroup[]
  dietary: DietaryTag[]
  allergens: Allergen[]
  hidden: boolean
  soldOut: boolean
}
type ServerMenu = { categories: MenuCategory[]; items: ServerItem[] }

export type MenuSync = {
  /** Where the menu comes from: still checking, the backend, or this browser only */
  source: 'connecting' | 'server' | 'browser'
  /** Why the last save failed, shown on the admin page */
  error: string | null
  /** Key for the admin endpoints (ADMIN_API_KEY in backend/.env) */
  adminKey: string
}

const ADMIN_KEY_STORAGE = 'oms-admin-key'
const MENU_POLL_MS = 5000

function readAdminKey(): string {
  try {
    return localStorage.getItem(ADMIN_KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

let sync: MenuSync = { source: 'connecting', error: null, adminKey: readAdminKey() }
const syncListeners = new Set<() => void>()

function setSync(patch: Partial<MenuSync>) {
  sync = { ...sync, ...patch }
  syncListeners.forEach((l) => l())
}

export function useMenuSync(): MenuSync {
  return useSyncExternalStore(
    (listener) => {
      syncListeners.add(listener)
      return () => syncListeners.delete(listener)
    },
    () => sync,
  )
}

/** Remember the admin key in this browser ('' forgets it) and reload the full menu */
export function setAdminKey(key: string, error: string | null = null) {
  try {
    if (key) localStorage.setItem(ADMIN_KEY_STORAGE, key)
    else localStorage.removeItem(ADMIN_KEY_STORAGE)
  } catch {
    // Not remembered; it still works until the page is reloaded
  }
  setSync({ adminKey: key, error })
  if (key) void refreshMenu()
}

function toMenuItem(i: ServerItem): MenuItem {
  return {
    id: i.id,
    categoryId: i.categoryId,
    name: i.name,
    description: i.description,
    price: i.price,
    image: i.image ?? undefined,
    recommended: i.recommended || undefined,
    optionGroups: i.optionGroups,
    dietary: i.dietary,
    allergens: i.allergens,
    hidden: i.hidden || undefined,
  }
}

async function fetchServerMenu(): Promise<ServerMenu> {
  if (sync.adminKey) {
    try {
      // The admin view also includes hidden dishes
      return await api<ServerMenu>('/admin/menu', { headers: { 'X-Admin-Key': sync.adminKey } })
    } catch (e) {
      if (!(e instanceof ApiError) || (e.status !== 401 && e.status !== 503)) throw e
      setAdminKey('', e.status === 401 ? 'That admin key was not accepted.' : e.message)
    }
  }
  return api<ServerMenu>('/menu')
}

/** Saves waiting to reach the server; refreshes wait for them so edits don't flicker back */
let pendingSaves = 0
let saveQueue: Promise<void> = Promise.resolve()

export async function refreshMenu() {
  try {
    const server = await fetchServerMenu()
    if (pendingSaves > 0) return
    const menu: MenuData = {
      categories: server.categories.map(({ id, name }) => ({ id, name })),
      items: server.items.map(toMenuItem),
    }
    const soldOut = server.items.filter((i) => i.soldOut).map((i) => i.id)
    if (JSON.stringify([menu, soldOut]) !== JSON.stringify([state.menu, state.soldOut])) {
      update((d) => {
        d.menu = menu
        d.soldOut = soldOut
      })
    }
    if (sync.source !== 'server') setSync({ source: 'server' })
  } catch {
    // Backend not running (or no menu tables yet): keep using this browser's menu
    if (sync.source !== 'browser') setSync({ source: 'browser' })
  }
}

/** Send an admin change to the server, one at a time and in order. No-op in browser mode. */
function saveToServer(method: 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown) {
  if (sync.source !== 'server') return
  pendingSaves++
  const headers = { 'X-Admin-Key': sync.adminKey }
  saveQueue = saveQueue
    .then(() =>
      api(`/admin/menu${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
    .then(
      () => setSync({ error: null }),
      (e: Error) => {
        if (e instanceof ApiError && e.status === 401) {
          setAdminKey('', 'That admin key was not accepted, so the change was not saved.')
        } else {
          setSync({ error: `The change could not be saved: ${e.message}` })
        }
      },
    )
    .finally(() => {
      pendingSaves--
      // Load what the server now has; this also undoes a change it refused
      if (pendingSaves === 0) void refreshMenu()
    })
}

const itemPath = (id: string) => `/items/${encodeURIComponent(id)}`
const categoryPath = (id: string) => `/categories/${encodeURIComponent(id)}`

void refreshMenu()
window.setInterval(() => {
  if (document.visibilityState === 'visible') void refreshMenu()
}, MENU_POLL_MS)
window.addEventListener('focus', () => void refreshMenu())

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
    const soldOut = !state.soldOut.includes(menuItemId)
    update((d) => {
      d.soldOut = soldOut ? [...d.soldOut, menuItemId] : d.soldOut.filter((id) => id !== menuItemId)
    })
    saveToServer('PATCH', itemPath(menuItemId), { soldOut })
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
    const savedHere = update((d) => {
      const i = d.menu.items.findIndex((m) => m.id === item.id)
      if (i >= 0) d.menu.items[i] = item
      else d.menu.items.push(item)
    })
    saveToServer('PUT', itemPath(item.id), {
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image ?? null,
      recommended: !!item.recommended,
      optionGroups: item.optionGroups ?? [],
      dietary: item.dietary ?? [],
      allergens: item.allergens ?? [],
      hidden: !!item.hidden,
    })
    // With the backend, a full browser storage doesn't matter: the server keeps the dish
    return savedHere || sync.source === 'server'
  },

  setMenuItemHidden(id: string, hidden: boolean) {
    update((d) => {
      const item = d.menu.items.find((m) => m.id === id)
      if (item) item.hidden = hidden
    })
    saveToServer('PATCH', itemPath(id), { hidden })
  },

  /** Only dishes that were never ordered can be deleted; others are hidden instead */
  deleteMenuItem(id: string): boolean {
    if (state.orders.some((o) => o.items.some((i) => i.menuItemId === id))) return false
    const savedHere = update((d) => {
      d.menu.items = d.menu.items.filter((m) => m.id !== id)
      d.soldOut = d.soldOut.filter((s) => s !== id)
    })
    saveToServer('DELETE', itemPath(id))
    return savedHere || sync.source === 'server'
  },

  addCategory(name: string): string {
    const id = `${slug(name) || 'category'}-${shortId().slice(0, 4).toLowerCase()}`
    update((d) => {
      d.menu.categories.push({ id, name })
    })
    saveToServer('PUT', categoryPath(id), { name })
    return id
  },

  renameCategory(id: string, name: string) {
    update((d) => {
      const c = d.menu.categories.find((x) => x.id === id)
      if (c) c.name = name
    })
    saveToServer('PUT', categoryPath(id), { name })
  },

  moveCategory(id: string, delta: -1 | 1) {
    const list = state.menu.categories
    const i = list.findIndex((c) => c.id === id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= list.length) return
    update((d) => {
      const cats = d.menu.categories
      ;[cats[i], cats[j]] = [cats[j], cats[i]]
    })
    saveToServer('PUT', '/categories/order', { ids: state.menu.categories.map((c) => c.id) })
  },

  /** Only empty categories can be deleted */
  deleteCategory(id: string): boolean {
    if (state.menu.items.some((m) => m.categoryId === id)) return false
    const savedHere = update((d) => {
      d.menu.categories = d.menu.categories.filter((c) => c.id !== id)
    })
    saveToServer('DELETE', categoryPath(id))
    return savedHere || sync.source === 'server'
  },

  /** Put the sample menu back (sold-out marks are cleared too). Browser mode only: with the
   * backend, reload the sample menu with `python -m app.seed_menu` instead. */
  resetMenu() {
    if (sync.source === 'server') return
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

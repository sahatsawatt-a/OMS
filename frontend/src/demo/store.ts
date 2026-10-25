// Client-side store backed by the OMS API.
// Staff screens load GET /api/staff/state (needs the staff key); a guest's phone loads
// GET /api/guest/state with its own device token (lib/guest.ts). They load again whenever the
// server says something changed (lib/live.ts), so every device sees the same tables and orders
// straight away. Actions call the API and refresh.
import { useEffect, useSyncExternalStore } from 'react'
import { api, ApiError, currentStaffKey, onStaffKeyChange } from '../lib/api'
import { onLiveChange } from '../lib/live'
import { shortId } from './ids'
import type { CardBrand, CartLine, DemoState, GuestState, ItemStatus, MenuItem, Order, PaymentMethod, PhotoSources, TableSession } from './types'

export { randomToken } from './ids'

// In case a change notice is missed (e.g. a socket that died without closing)
const SAFETY_REFRESH_MS = 30_000

type Listener = () => void

/** A value fetched from the API and refreshed while someone is looking at it */
function polled<T>(load: () => Promise<T>) {
  let value: T | null = null
  let error: ApiError | null = null
  let timer: number | undefined
  let stopLive: (() => void) | undefined
  let inFlight: Promise<void> | null = null
  let users = 0
  const listeners = new Set<Listener>()
  const emit = () => listeners.forEach((l) => l())

  const refresh = (): Promise<void> => {
    inFlight ??= load()
      .then((v) => {
        value = v
        error = null
      })
      .catch((e: unknown) => {
        error = e instanceof ApiError ? e : new ApiError('The server is not reachable. Retrying…', 0)
      })
      .finally(() => {
        inFlight = null
        emit()
      })
    return inFlight
  }

  // Background tabs skip refreshes; lib/live.ts catches them up when they become visible
  const refreshIfVisible = () => {
    if (document.visibilityState === 'visible') void refresh()
  }

  const start = () => {
    if (users++ === 0) {
      void refresh()
      stopLive = onLiveChange(refreshIfVisible)
      timer = window.setInterval(refreshIfVisible, SAFETY_REFRESH_MS)
    }
  }
  const stop = () => {
    if (--users === 0) {
      window.clearInterval(timer)
      stopLive?.()
    }
  }

  return {
    refresh,
    reset() {
      value = null
      error = null
      emit()
    },
    subscribe(l: Listener) {
      listeners.add(l)
      start()
      return () => {
        listeners.delete(l)
        stop()
      }
    },
    get value() {
      return value
    },
    get error() {
      return error
    },
  }
}

// ---- Staff state ----

type StaffStateResponse = Omit<DemoState, 'soldOut'>

let staffSnapshot: DemoState | null = null
const staff = polled(async () => {
  const s = await api<StaffStateResponse>('/staff/state', { staff: true })
  staffSnapshot = { ...s, soldOut: s.menu.soldOut ?? [] }
  return staffSnapshot
})
onStaffKeyChange(() => {
  staffSnapshot = null
  staff.reset()
  if (currentStaffKey()) void staff.refresh()
})

function subscribeKey(l: Listener) {
  const off = onStaffKeyChange(l)
  return () => {
    off()
  }
}

/** Whether this device has a staff key saved */
export function useHasStaffKey() {
  return useSyncExternalStore(subscribeKey, () => currentStaffKey() !== '')
}

/** Staff screens: null until the first load. Render inside <StaffGate>, which waits for it. */
export function useStaffState(): DemoState | null {
  return useSyncExternalStore(staff.subscribe, () => staffSnapshot)
}

/** For screens inside <StaffGate>, where the state is always loaded */
export function useDemoState(): DemoState {
  const state = useStaffState()
  if (!state) throw new Error('useDemoState must be used inside <StaffGate>')
  return state
}

export function useStaffError(): ApiError | null {
  return useSyncExternalStore(staff.subscribe, () => staff.error)
}

// ---- Action errors (shown as a banner on staff screens) ----

let actionError: string | null = null
const errorListeners = new Set<Listener>()
function setActionError(message: string | null) {
  actionError = message
  errorListeners.forEach((l) => l())
}
function subscribeErrors(l: Listener) {
  errorListeners.add(l)
  return () => {
    errorListeners.delete(l)
  }
}
export function useActionError(): [string | null, () => void] {
  const message = useSyncExternalStore(subscribeErrors, () => actionError)
  return [message, () => setActionError(null)]
}

/** Run a staff action, refresh the screen, and report failures; resolves to null on failure */
async function run<T>(call: () => Promise<T>): Promise<T | null> {
  try {
    const result = await call()
    setActionError(null)
    return result
  } catch (e) {
    setActionError(e instanceof Error ? e.message : 'Something went wrong')
    return null
  } finally {
    await staff.refresh()
  }
}

const post = <T = { ok: boolean },>(path: string, json?: unknown) => api<T>(path, { method: 'POST', staff: true, json: json ?? {} })
const put = <T = { ok: boolean },>(path: string, json: unknown) => api<T>(path, { method: 'PUT', staff: true, json })

// ---- Guest state ----

type GuestEntry = ReturnType<typeof polled<GuestState>> & { snapshot: GuestState | null }
const guests = new Map<string, GuestEntry>()

// Guest calls send this phone's device token in a header, never in the URL (REQ-36)
const asDevice = (deviceToken: string) => ({ 'X-Device-Token': deviceToken })

function guestEntry(deviceToken: string): GuestEntry {
  let entry = guests.get(deviceToken)
  if (!entry) {
    const e = polled(async () => {
      const s = await api<GuestState>('/guest/state', { headers: asDevice(deviceToken) })
      e.snapshot = s
      return s
    }) as GuestEntry
    e.snapshot = null
    guests.set(deviceToken, e)
    entry = e
  }
  return entry
}

/**
 * A guest phone's table. `missing`: the server doesn't know this phone (e.g. scan the QR again);
 * `removed`: staff removed it from the table.
 */
export function useGuestState(deviceToken: string): {
  state: GuestState | null
  missing: boolean
  removed: boolean
  error: ApiError | null
} {
  const entry = guestEntry(deviceToken)
  const state = useSyncExternalStore(entry.subscribe, () => entry.snapshot)
  const error = useSyncExternalStore(entry.subscribe, () => entry.error)
  const missing = error?.status === 401
  const removed = error?.status === 403
  return { state, missing, removed, error: missing || removed ? null : error }
}

export function refreshGuest(deviceToken: string) {
  return guestEntry(deviceToken).refresh()
}

/** Keep a guest's view fresh right away after something changed on the phone */
export function useRefreshOnFocus(deviceToken: string) {
  useEffect(() => {
    const onFocus = () => void refreshGuest(deviceToken)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [deviceToken])
}

// ---- Rules shared with the backend (backend/app/services/orders.py) ----

// Allowed item status changes; no kitchen control for now, so staff mark food served
const NEXT_STATUS: Record<ItemStatus, ItemStatus[]> = {
  submitted: ['served', 'cancelled'],
  served: [],
  cancelled: [],
}

export function canMoveTo(from: ItemStatus, to: ItemStatus): boolean {
  return NEXT_STATUS[from].includes(to)
}

// ---- Guest actions ----

export type StripeCheckout = { intentId: string; clientSecret?: string; simulated: boolean }

/** The cart as the server wants it: dish and option ids only; the server sets the prices */
const toLines = (lines: CartLine[]) =>
  lines.map((l) => ({
    menuItemId: l.menuItemId,
    quantity: l.quantity,
    note: l.note,
    options: l.options.filter((o) => o.groupId && o.choiceId).map((o) => ({ groupId: o.groupId, choiceId: o.choiceId })),
  }))

export const guestActions = {
  /** Pay first. "counter": the order waits for staff. "stripe": the reply carries the payment to take. */
  async placeOrder(deviceToken: string, lines: CartLine[], pay: 'stripe' | 'counter') {
    const res = await api<{ order: Order; payment?: StripeCheckout }>('/guest/orders', {
      method: 'POST',
      headers: asDevice(deviceToken),
      json: { lines: toLines(lines), pay },
    })
    if (pay === 'counter') void refreshGuest(deviceToken)
    return res
  },

  /** Ask the server (which asks Stripe) whether the order is paid */
  async confirmPayment(deviceToken: string, orderId: string) {
    const res = await api<{ status: string; order: Order }>(`/guest/orders/${encodeURIComponent(orderId)}/confirm-payment`, {
      method: 'POST',
      headers: asDevice(deviceToken),
    })
    void refreshGuest(deviceToken)
    return res
  },

  /** Same, for guests coming back from a redirect-based payment method */
  async confirmIntent(deviceToken: string, intentId: string) {
    const res = await api<{ status: string; order: Order }>(`/guest/payments/${encodeURIComponent(intentId)}/confirm`, {
      method: 'POST',
      headers: asDevice(deviceToken),
    })
    void refreshGuest(deviceToken)
    return res
  },

  /** The guest left checkout without paying */
  abandon(deviceToken: string, orderId: string) {
    return api(`/guest/orders/${encodeURIComponent(orderId)}/abandon`, { method: 'POST', headers: asDevice(deviceToken) }).catch(
      () => undefined,
    )
  },

  async callWaiter(deviceToken: string) {
    await api('/guest/waiter', { method: 'POST', headers: asDevice(deviceToken) })
    void refreshGuest(deviceToken)
  },
}

// ---- Staff actions ----

export const actions = {
  /** Seat guests: opens a session (the QR token). A table already seated returns its open session. */
  openSession(tableId: string, guests: number): Promise<TableSession | null> {
    return run(() => post<TableSession>(`/tables/${encodeURIComponent(tableId)}/sessions`, { guests }))
  },

  /** Staff took the money at the counter, less any discount (cents); the order now goes through */
  confirmCounterPayment(orderId: string, payment: { method: Exclude<PaymentMethod, 'stripe'>; discount?: number; cardBrand?: CardBrand }) {
    return run(() => post(`/orders/${orderId}/counter-payment`, payment))
  },

  /** Cancel an order that was never paid; nothing is made */
  cancelUnpaidOrder(orderId: string) {
    return run(() => post(`/orders/${orderId}/cancel`))
  },

  /** All food of a paid order has been brought to the table */
  markOrderServed(orderId: string) {
    return run(() => post(`/orders/${orderId}/served`))
  },

  /** Guests have left: the QR and every phone stop working. Refused while an order is unpaid. */
  async clearTable(sessionId: number): Promise<boolean> {
    return (await run(() => post(`/sessions/${sessionId}/close`))) !== null
  },

  /** A phone that shouldn't be at the table (e.g. a photo of the QR code): it stops working */
  removeDevice(sessionId: number, label: string) {
    return run(() => api(`/sessions/${sessionId}/devices/${encodeURIComponent(label)}`, { method: 'DELETE', staff: true }))
  },

  setItemStatus(orderId: string, itemId: string, to: ItemStatus) {
    return run(() => put(`/orders/${orderId}/items/${itemId}/status`, { status: to }))
  },

  acknowledgeWaiter(sessionId: number) {
    return run(() => api(`/sessions/${sessionId}/waiter`, { method: 'DELETE', staff: true }))
  },

  setSoldOut(menuItemId: string, value: boolean) {
    return run(() => put(`/menu/items/${encodeURIComponent(menuItemId)}/sold-out`, { value }))
  },

  toggleSoldOut(menuItemId: string) {
    return actions.setSoldOut(menuItemId, !staffSnapshot?.soldOut.includes(menuItemId))
  },

  /** Demo: back to the sample tables and orders; the menu is kept */
  reset() {
    return run(() => post('/demo/reset'))
  },

  /** Demo: no tables seated, no orders; the menu is kept */
  clear() {
    return run(() => post('/demo/clear'))
  },

  // ---- Menu admin ----

  /** Add a dish or replace the one with the same id */
  async saveMenuItem(item: MenuItem, soldOut?: boolean): Promise<boolean> {
    return (await run(() => put(`/menu/items/${encodeURIComponent(item.id)}`, { ...item, soldOut }))) !== null
  },

  setMenuItemHidden(id: string, hidden: boolean) {
    return run(() => put(`/menu/items/${encodeURIComponent(id)}/hidden`, { value: hidden }))
  },

  /** Only dishes that were never ordered can be deleted; others are hidden instead */
  async deleteMenuItem(id: string): Promise<boolean> {
    return (await run(() => api(`/menu/items/${encodeURIComponent(id)}`, { method: 'DELETE', staff: true }))) !== null
  },

  /** Returns the new category's id, or null when it could not be added */
  async addCategory(name: string): Promise<string | null> {
    return (await run(() => post<{ id: string }>('/menu/categories', { name })))?.id ?? null
  },

  renameCategory(id: string, name: string) {
    return run(() => api(`/menu/categories/${encodeURIComponent(id)}`, { method: 'PATCH', staff: true, json: { name } }))
  },

  moveCategory(id: string, delta: -1 | 1) {
    return run(() => post(`/menu/categories/${encodeURIComponent(id)}/move`, { delta }))
  },

  /** Only empty categories can be deleted */
  async deleteCategory(id: string): Promise<boolean> {
    return (await run(() => api(`/menu/categories/${encodeURIComponent(id)}`, { method: 'DELETE', staff: true }))) !== null
  },

  /** Which photos the guest menu shows */
  setPhotoSources(sources: PhotoSources) {
    return run(() => put('/menu/photo-sources', sources))
  },

  /** Put the sample menu back (sold-out marks are cleared too) */
  resetMenu() {
    return run(() => post('/menu/reset'))
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
  return `${slug(name) || 'dish'}-${shortId().slice(0, 4).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`
}

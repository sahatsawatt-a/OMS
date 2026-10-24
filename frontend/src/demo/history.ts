// Generated sample trading history so the admin reports have something to show.
// Computed on the fly (never stored) and repeatable: the same day always yields the same history.
import type { CardBrand, MenuItem, Order, OrderItem, PaymentMethod, SelectedOption, Table, TableSession } from './types'

const MIN = 60 * 1000

/** Small seeded random number generator (mulberry32) */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The live menu sorted into what a table typically orders, by the menu's sections */
type Courses = { mains: MenuItem[]; starters: MenuItem[]; drinks: MenuItem[]; desserts: MenuItem[] }

const SECTIONS: Record<keyof Courses, string[]> = {
  mains: ['stir-fried-noodles', 'soup-noodles', 'curry', 'stir-fried', 'specials', 'rice'],
  starters: ['appetizers', 'salad', 'soup'],
  drinks: ['drinks'],
  desserts: ['desserts'],
}

function courses(menu: MenuItem[]): Courses {
  // Sides (rice, roti) and corkage are not a course of their own
  const dishes = menu.filter((m) => !m.hidden && m.price >= 600)
  const drinks = menu.filter((m) => !m.hidden && m.categoryId === 'drinks' && m.id !== 'byo-wine')
  const of = (key: keyof Courses) => {
    const list = (key === 'drinks' ? drinks : dishes).filter((m) => SECTIONS[key].includes(m.categoryId))
    // A renamed or new menu still gets some history
    return list.length ? list : dishes.length ? dishes : menu
  }
  return { mains: of('mains'), starters: of('starters'), drinks: of('drinks'), desserts: of('desserts') }
}

/** Popular dishes are picked more often */
function pick(list: MenuItem[], r: () => number): MenuItem {
  const weights = list.map((m) => (m.recommended ? 3 : 1))
  let n = r() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < list.length; i++) {
    n -= weights[i]
    if (n <= 0) return list[i]
  }
  return list[list.length - 1]
}

function item(menu: MenuItem, quantity: number, r: () => number): OrderItem {
  // Usually the free first choice of each option group; sometimes a paid one (e.g. prawns)
  const options: SelectedOption[] = (menu.optionGroups ?? []).flatMap((g) => {
    if (g.type === 'multi') return []
    const paid = g.choices.find((c) => c.price > 0)
    const c = paid && r() < 0.2 ? paid : g.choices[0]
    return [{ groupId: g.id, choiceId: c.id, groupName: g.name, choiceName: c.name, price: c.price }]
  })
  return {
    id: `h${Math.floor(r() * 1e9).toString(36)}`,
    menuItemId: menu.id,
    name: menu.name,
    unitPrice: menu.price + options.reduce((n, o) => n + o.price, 0),
    quantity,
    options,
    note: '',
    status: 'served',
  }
}

export type History = { sessions: TableSession[]; orders: Order[] }

function paidWith(method: PaymentMethod, orderId: string, amount: number, paidAt: number): Order['payment'] {
  return { status: 'paid', method, cardBrand: method === 'cash' ? undefined : sampleCardBrand(orderId), amount, paidAt }
}

function payMethod(r: () => number): PaymentMethod {
  const m = r()
  return m < 0.55 ? 'stripe' : m < 0.9 ? 'card_terminal' : 'cash'
}

/**
 * A sample card type for a card payment, roughly the Australian mix (Visa about half, then
 * Mastercard, eftpos and Amex). Taken from a hash of the order id rather than the random
 * sequence, so adding it left every other sample figure unchanged.
 */
function sampleCardBrand(orderId: string): CardBrand {
  let h = 2166136261
  for (let i = 0; i < orderId.length; i++) h = Math.imul(h ^ orderId.charCodeAt(i), 16777619)
  const x = (h >>> 0) / 4294967296
  return x < 0.5 ? 'visa' : x < 0.78 ? 'mastercard' : x < 0.9 ? 'eftpos' : x < 0.97 ? 'amex' : 'other'
}

function generateDay(dayStart: number, r: () => number, until: number, out: History, menu: Courses, tables: Table[]) {
  const weekday = new Date(dayStart).getDay()
  const busy = weekday === 5 || weekday === 6 ? 1.45 : weekday === 1 ? 0.75 : 1
  // Gentle seasonality: busier in the Melbourne summer (Dec to Feb)
  const month = new Date(dayStart).getMonth()
  const season = month === 11 || month <= 1 ? 1.15 : month >= 5 && month <= 7 ? 0.9 : 1
  const services = [
    { from: 11.5, to: 14.5, count: Math.round((8 + r() * 6) * busy * season) },
    { from: 17.5, to: 21.5, count: Math.round((13 + r() * 8) * busy * season) },
  ]
  // Order numbers restart at 101 each day. Today's live demo orders also start at 101, so today's
  // sample orders start at 601 to keep every order number in the Payments list unique.
  let number = until - dayStart < 24 * 60 * MIN ? 601 : 101
  services.forEach((service, si) => {
    for (let i = 0; i < service.count; i++) {
      const table = tables[Math.floor(r() * tables.length)]
      const guests = Math.max(1, Math.min(table.seats, Math.round(1 + r() * table.seats)))
      const openedAt = dayStart + (service.from + r() * (service.to - service.from)) * 60 * MIN
      const closedAt = openedAt + (40 + r() * 55) * MIN
      if (closedAt > until) continue
      const token = `hist-${dayStart}-${si}-${i}`

      // First order: mains and drinks; sometimes a second order later (dessert or more drinks)
      const first: OrderItem[] = []
      for (let g = 0; g < guests; g++) first.push(item(pick(menu.mains, r), 1, r))
      if (r() < 0.6) first.push(item(pick(menu.starters, r), 1 + Math.floor(r() * 2), r))
      first.push(item(pick(menu.drinks, r), Math.max(1, Math.round(guests * (0.5 + r() * 0.7))), r))
      const rounds: { at: number; items: OrderItem[] }[] = [{ at: openedAt + 5 * MIN, items: first }]
      if (r() < 0.4) {
        const more: OrderItem[] = [item(pick(r() < 0.6 ? menu.desserts : menu.drinks, r), 1 + Math.floor(r() * guests * 0.6), r)]
        rounds.push({ at: openedAt + (25 + r() * 15) * MIN, items: more })
      }

      rounds.forEach((round, ri) => {
        const id = `${token}-o${ri}`
        const amount = round.items.filter((x) => x.status !== 'cancelled').reduce((n, x) => n + x.unitPrice * x.quantity, 0)
        // About 2% of orders are left unpaid at the counter and cancelled
        const cancelled = r() < 0.02
        if (cancelled) round.items.forEach((x) => (x.status = 'cancelled'))
        out.orders.push({
          id,
          number: number++,
          sessionToken: token,
          tableNumber: table.number,
          round: ri + 1,
          createdAt: round.at,
          items: round.items,
          payment: cancelled
            ? { status: 'cancelled', amount, cancelledAt: round.at + 6 * MIN }
            : paidWith(payMethod(r), id, amount, round.at + MIN),
        })
      })
      out.sessions.push({ id: 0, token, tableId: table.id, tableNumber: table.number, guests, status: 'closed', openedAt, closedAt })
    }
  })
}

/**
 * Closed table visits with their paid orders for the past `days` days plus today up to `now`.
 * Today's live demo tables are not included; reports add those from the store.
 */
export function sampleHistory(now: number, menu: MenuItem[], tables: Table[], days = 400): History {
  const today = new Date(now)
  const out: History = { sessions: [], orders: [] }
  if (menu.length === 0 || tables.length === 0) return out
  const dishes = courses(menu)
  for (let d = days; d >= 0; d--) {
    // Calendar days, not 24 h steps, so daylight-saving changes don't shift midnight
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - d).getTime()
    // Seed by calendar date so each day's history stays the same across reloads
    const date = new Date(dayStart)
    generateDay(dayStart, rng(date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()), now, out, dishes, tables)
  }
  return out
}

// Generating a year takes a few hundred ms, so keep one copy per calendar day
let cached: { key: string; history: History } | null = null

/** sampleHistory for today and the current menu, generated once and shared by every report */
export function historyForToday(now: number, menu: MenuItem[], tables: Table[]): History {
  // Prices or dishes changing in the admin page give a fresh history
  const key = `${new Date(now).toDateString()}|${tables.length}|${menu.map((m) => `${m.id}:${m.price}`).join(',')}`
  if (cached?.key !== key) cached = { key, history: sampleHistory(now, menu, tables) }
  return cached.history
}

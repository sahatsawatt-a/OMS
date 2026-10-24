// Sales figures for the admin Reports tab. Pay first: every order is paid when it is placed,
// so revenue is the sum of paid orders, counted at the time of payment.
import { CARD_BRAND_LABEL } from '../../components/format'
import { gstIncluded } from '../../demo/money'
import type { History } from '../../demo/history'
import type { DemoState, Order, PaymentMethod } from '../../demo/types'

// ---------- Periods ----------

export type Preset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom'
export type CompareMode = 'previous' | 'lastWeek'

export const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
]

export type Range = { start: number; end: number; days: number; label: string }

const DAY_MS = 24 * 60 * 60 * 1000

export const startOfDay = (t: number, offsetDays = 0) => {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays).getTime()
}

const fmtDay = (t: number) => new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

/** [start, end) for a preset; custom uses yyyy-mm-dd strings, both days included */
export function rangeFor(preset: Preset, now: number, custom?: { from: string; to: string }): Range {
  const today = startOfDay(now)
  switch (preset) {
    case 'today':
      return { start: today, end: now, days: 1, label: 'Today' }
    case 'yesterday':
      return { start: startOfDay(now, -1), end: today, days: 1, label: 'Yesterday' }
    case '7d':
      return { start: startOfDay(now, -6), end: now, days: 7, label: 'Last 7 days' }
    case '30d':
      return { start: startOfDay(now, -29), end: now, days: 30, label: 'Last 30 days' }
    case 'month': {
      const d = new Date(now)
      const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
      return { start, end: now, days: d.getDate(), label: d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }) }
    }
    case 'custom': {
      const from = custom?.from ? new Date(`${custom.from}T00:00`).getTime() : startOfDay(now, -6)
      const toDay = custom?.to ? new Date(`${custom.to}T00:00`).getTime() : today
      const start = Math.min(from, toDay)
      const end = Math.min(startOfDay(Math.max(from, toDay), 1), now)
      const days = Math.max(1, Math.round((startOfDay(end - 1, 1) - start) / DAY_MS))
      return { start, end, days, label: days === 1 ? fmtDay(start) : `${fmtDay(start)} – ${fmtDay(end - 1)}` }
    }
  }
}

/** The range to compare with: the same length just before, or the same days one week earlier */
export function compareRange(range: Range, mode: CompareMode): Range & { label: string } {
  if (mode === 'lastWeek') {
    return { start: range.start - 7 * DAY_MS, end: range.end - 7 * DAY_MS, days: range.days, label: 'vs same days last week' }
  }
  // Same number of days just before, up to the same time of day (so a morning compares with a morning)
  const shift = range.days * DAY_MS
  return { start: range.start - shift, end: range.end - shift, days: range.days, label: 'vs previous period' }
}

// ---------- Shared data ----------

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  stripe: 'Phone (Stripe)',
  card_terminal: 'Counter card',
  cash: 'Counter cash',
}

export type Data = { orders: Order[]; state: DemoState }

/** History plus the live demo orders, oldest first */
export function combine(state: DemoState, history: History): Data {
  return { orders: [...history.orders, ...state.orders], state }
}

const sum = <T,>(list: T[], f: (x: T) => number) => list.reduce((n, x) => n + f(x), 0)
const paidIn = (orders: Order[], start: number, end: number) =>
  orders.filter((o) => o.payment.status === 'paid' && o.payment.paidAt! >= start && o.payment.paidAt! < end)

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export const toCsv = (rows: (string | number)[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\n')

// ---------- Sales ----------

export type Bucket = { key: string; label: string; longLabel: string; revenue: number; orders: number }
export type DishRow = { id: string; name: string; category: string; qty: number; revenue: number }
export type CategoryRow = { name: string; qty: number; revenue: number; share: number }
export type PaymentRow = { method: PaymentMethod; label: string; amount: number; count: number; share: number }

export type SalesReport = {
  revenue: number
  gst: number
  orders: number
  avgOrder: number
  itemsSold: number
  prev: { revenue: number; orders: number; avgOrder: number }
  waiting: { orders: number; amount: number }
  cancelled: { orders: number; amount: number }
  /** Taken off counter bills; revenue is already after them */
  discounts: { orders: number; amount: number }
  buckets: Bucket[]
  bucketUnit: 'hour' | 'day' | 'month'
  dishes: DishRow[]
  categories: CategoryRow[]
  payments: PaymentRow[]
  csv: string
}

export function salesReport({ orders, state }: Data, range: Range, compare: Range): SalesReport {
  const paid = paidIn(orders, range.start, range.end)
  const prevPaid = paidIn(orders, compare.start, compare.end)
  const revenue = sum(paid, (o) => o.payment.amount)
  const prevRevenue = sum(prevPaid, (o) => o.payment.amount)

  const waitingOrders = state.orders.filter((o) => o.payment.status === 'awaiting_counter' && !!o.sessionToken && state.sessions[o.sessionToken]?.status === 'open')
  const cancelledOrders = orders.filter(
    (o) => o.payment.status === 'cancelled' && o.payment.cancelledAt! >= range.start && o.payment.cancelledAt! < range.end,
  )

  // Revenue over time: by hour for one day, by day up to two months, by month beyond that
  const bucketUnit: SalesReport['bucketUnit'] = range.days <= 1 ? 'hour' : range.days <= 62 ? 'day' : 'month'
  const buckets: Bucket[] = []
  const keyOf = (t: number) => {
    const d = new Date(t)
    return bucketUnit === 'hour' ? `h${d.getHours()}` : bucketUnit === 'day' ? `d${startOfDay(t)}` : `m${d.getFullYear()}-${d.getMonth()}`
  }
  if (bucketUnit === 'hour') {
    const hour = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString('en-AU', { hour: 'numeric' })
    for (let h = 10; h <= 23; h++) buckets.push({ key: `h${h}`, label: hour(h), longLabel: `${hour(h)} to ${hour(h + 1)}`, revenue: 0, orders: 0 })
  } else if (bucketUnit === 'day') {
    for (let d = 0; d < range.days; d++) {
      const t = startOfDay(range.start, d)
      const date = new Date(t)
      buckets.push({
        key: `d${t}`,
        label: range.days <= 7 ? date.toLocaleDateString('en-AU', { weekday: 'short' }) : String(date.getDate()),
        longLabel: date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }),
        revenue: 0,
        orders: 0,
      })
    }
  } else {
    const d = new Date(range.start)
    for (let m = new Date(d.getFullYear(), d.getMonth(), 1); m.getTime() < range.end; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      buckets.push({
        key: `m${m.getFullYear()}-${m.getMonth()}`,
        label: m.toLocaleDateString('en-AU', { month: 'short' }),
        longLabel: m.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }),
        revenue: 0,
        orders: 0,
      })
    }
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  for (const o of paid) {
    const b = byKey.get(keyOf(o.payment.paidAt!))
    if (b) {
      b.revenue += o.payment.amount
      b.orders += 1
    }
  }

  // Dishes and categories
  const categoryOf = (id: string) => {
    const item = state.menu.items.find((m) => m.id === id)
    return state.menu.categories.find((c) => c.id === item?.categoryId)?.name ?? 'Other'
  }
  const dishMap = new Map<string, DishRow>()
  const csvRows: (string | number)[][] = [['Paid at', 'Order', 'Table', 'Dish', 'Category', 'Quantity', 'Unit price (AUD)', 'Line total (AUD)', 'Payment', 'Card brand', 'Order discount (AUD)']]
  for (const o of paid) {
    let first = true
    for (const i of o.items) {
      if (i.status === 'cancelled') continue
      const category = categoryOf(i.menuItemId)
      const row = dishMap.get(i.menuItemId) ?? { id: i.menuItemId, name: i.name, category, qty: 0, revenue: 0 }
      row.qty += i.quantity
      row.revenue += i.unitPrice * i.quantity
      dishMap.set(i.menuItemId, row)
      csvRows.push([
        new Date(o.payment.paidAt!).toLocaleString('en-AU'),
        o.number,
        o.tableNumber,
        i.name,
        category,
        i.quantity,
        (i.unitPrice / 100).toFixed(2),
        ((i.unitPrice * i.quantity) / 100).toFixed(2),
        PAYMENT_LABEL[o.payment.method!],
        o.payment.cardBrand ? CARD_BRAND_LABEL[o.payment.cardBrand] : '',
        // Once per order, on its first line, so the column adds up
        first && o.payment.discount ? (o.payment.discount / 100).toFixed(2) : '',
      ])
      first = false
    }
  }
  const dishes = [...dishMap.values()].sort((a, b) => b.revenue - a.revenue)
  const itemRevenue = sum(dishes, (d) => d.revenue) || 1
  const catMap = new Map<string, CategoryRow>()
  for (const d of dishes) {
    const row = catMap.get(d.category) ?? { name: d.category, qty: 0, revenue: 0, share: 0 }
    row.qty += d.qty
    row.revenue += d.revenue
    catMap.set(d.category, row)
  }

  // Fixed order so each method keeps its colour whatever the figures are
  const methods: PaymentMethod[] = ['stripe', 'card_terminal', 'cash']
  const payments = methods.map((method) => {
    const list = paid.filter((o) => o.payment.method === method)
    const amount = sum(list, (o) => o.payment.amount)
    return { method, label: PAYMENT_LABEL[method], amount, count: list.length, share: revenue ? amount / revenue : 0 }
  })

  return {
    revenue,
    gst: gstIncluded(revenue),
    orders: paid.length,
    avgOrder: paid.length ? Math.round(revenue / paid.length) : 0,
    itemsSold: sum(dishes, (d) => d.qty),
    prev: { revenue: prevRevenue, orders: prevPaid.length, avgOrder: prevPaid.length ? Math.round(prevRevenue / prevPaid.length) : 0 },
    waiting: { orders: waitingOrders.length, amount: sum(waitingOrders, (o) => o.payment.amount) },
    cancelled: { orders: cancelledOrders.length, amount: sum(cancelledOrders, (o) => o.payment.amount) },
    discounts: { orders: paid.filter((o) => o.payment.discount).length, amount: sum(paid, (o) => o.payment.discount ?? 0) },
    buckets,
    bucketUnit,
    dishes,
    categories: [...catMap.values()].map((c) => ({ ...c, share: c.revenue / itemRevenue })).sort((a, b) => b.revenue - a.revenue),
    payments,
    csv: toCsv(csvRows),
  }
}

// ---------- Busiest times ----------

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const HOURS = Array.from({ length: 14 }, (_, i) => 10 + i)
export const LUNCH_ENDS = 16 // orders paid before 4 pm count as lunch

export type HeatCell = { day: number; hour: number; orders: number; revenue: number; avgOrders: number; avgRevenue: number }
export type ServiceRow = { name: 'Lunch' | 'Dinner'; orders: number; revenue: number; avgOrder: number; share: number }

export type BusyReport = {
  cells: HeatCell[]
  max: { avgOrders: number; avgRevenue: number }
  peak: HeatCell | null
  services: ServiceRow[]
  /** How many of each weekday the range covers, for averaging */
  dayCounts: number[]
}

export function busyReport({ orders }: Data, range: Range): BusyReport {
  const paid = paidIn(orders, range.start, range.end)
  const dayCounts = Array(7).fill(0)
  for (let d = 0; d < range.days; d++) dayCounts[(new Date(startOfDay(range.start, d)).getDay() + 6) % 7] += 1

  const cells: HeatCell[] = WEEKDAYS.flatMap((_, day) => HOURS.map((hour) => ({ day, hour, orders: 0, revenue: 0, avgOrders: 0, avgRevenue: 0 })))
  const cellAt = (day: number, hour: number) => cells[day * HOURS.length + (hour - HOURS[0])]
  const services: Record<'Lunch' | 'Dinner', { orders: number; revenue: number }> = { Lunch: { orders: 0, revenue: 0 }, Dinner: { orders: 0, revenue: 0 } }

  for (const o of paid) {
    const d = new Date(o.payment.paidAt!)
    const day = (d.getDay() + 6) % 7
    const hour = d.getHours()
    if (hour >= HOURS[0] && hour <= HOURS[HOURS.length - 1]) {
      const c = cellAt(day, hour)
      c.orders += 1
      c.revenue += o.payment.amount
    }
    const s = services[hour < LUNCH_ENDS ? 'Lunch' : 'Dinner']
    s.orders += 1
    s.revenue += o.payment.amount
  }
  for (const c of cells) {
    const n = dayCounts[c.day] || 1
    c.avgOrders = c.orders / n
    c.avgRevenue = c.revenue / n
  }
  const total = services.Lunch.revenue + services.Dinner.revenue || 1
  const peak = cells.reduce<HeatCell | null>((best, c) => (c.avgRevenue > (best?.avgRevenue ?? 0) ? c : best), null)
  return {
    cells,
    max: { avgOrders: Math.max(...cells.map((c) => c.avgOrders)), avgRevenue: Math.max(...cells.map((c) => c.avgRevenue)) },
    peak,
    services: (['Lunch', 'Dinner'] as const).map((name) => ({
      name,
      orders: services[name].orders,
      revenue: services[name].revenue,
      avgOrder: services[name].orders ? Math.round(services[name].revenue / services[name].orders) : 0,
      share: services[name].revenue / total,
    })),
    dayCounts,
  }
}

// ---------- GST / BAS ----------

// Estimate only: Stripe Australia's standard rate for domestic cards. Check real fees in the Stripe dashboard.
export const STRIPE_FEE_RATE = 0.0175
export const STRIPE_FEE_FIXED = 30

export type GstRow = {
  key: string
  label: string
  partial: boolean
  sales: number
  gst: number
  exGst: number
  orders: number
  stripeSales: number
  stripeFees: number
  stripeNet: number
}

/** Australian financial year starting 1 July of `startYear` */
export function financialYears(now: number): { startYear: number; label: string }[] {
  const d = new Date(now)
  const current = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1
  return [current, current - 1].map((y) => ({ startYear: y, label: `FY ${y}–${String(y + 1).slice(2)}` }))
}

function gstRow(key: string, label: string, list: Order[], partial: boolean): GstRow {
  const sales = sum(list, (o) => o.payment.amount)
  const stripe = list.filter((o) => o.payment.method === 'stripe')
  const stripeSales = sum(stripe, (o) => o.payment.amount)
  const stripeFees = sum(stripe, (o) => Math.round(o.payment.amount * STRIPE_FEE_RATE) + STRIPE_FEE_FIXED)
  const gst = gstIncluded(sales)
  return { key, label, partial, sales, gst, exGst: sales - gst, orders: list.length, stripeSales, stripeFees, stripeNet: stripeSales - stripeFees }
}

export type GstReport = { quarters: GstRow[]; months: GstRow[]; year: GstRow; firstData: number | null; csv: string }

export function gstReport({ orders }: Data, startYear: number, now: number): GstReport {
  const paid = orders.filter((o) => o.payment.status === 'paid')
  const firstData = paid.length ? Math.min(...paid.map((o) => o.payment.paidAt!)) : null
  const fyStart = new Date(startYear, 6, 1).getTime()
  const fyEnd = new Date(startYear + 1, 6, 1).getTime()
  const inRange = (s: number, e: number) => paid.filter((o) => o.payment.paidAt! >= s && o.payment.paidAt! < e)
  const isPartial = (s: number, e: number) => e > now || (firstData !== null && firstData > s)

  const months: GstRow[] = []
  for (let m = 0; m < 12; m++) {
    const s = new Date(startYear, 6 + m, 1).getTime()
    const e = new Date(startYear, 7 + m, 1).getTime()
    if (s > now) break
    months.push(gstRow(`m${m}`, new Date(s).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }), inRange(s, e), isPartial(s, e)))
  }
  const QUARTER_NAMES = ['Jul–Sep', 'Oct–Dec', 'Jan–Mar', 'Apr–Jun']
  const quarters: GstRow[] = []
  for (let q = 0; q < 4; q++) {
    const s = new Date(startYear, 6 + q * 3, 1).getTime()
    const e = new Date(startYear, 9 + q * 3, 1).getTime()
    if (s > now) break
    const year = new Date(s).getFullYear()
    quarters.push(gstRow(`q${q}`, `Q${q + 1} ${QUARTER_NAMES[q]} ${year}`, inRange(s, e), isPartial(s, e)))
  }
  const year = gstRow('fy', `FY ${startYear}–${String(startYear + 1).slice(2)}`, inRange(fyStart, fyEnd), isPartial(fyStart, fyEnd))

  const money = (c: number) => (c / 100).toFixed(2)
  const csv = toCsv([
    ['Period', 'G1 Total sales incl. GST (AUD)', '1A GST on sales (AUD)', 'Sales excl. GST (AUD)', 'Paid orders', 'Phone (Stripe) sales (AUD)', 'Est. Stripe fees (AUD)', 'Est. Stripe net (AUD)', 'Partial'],
    ...[...quarters, ...months, year].map((r) => [r.label, money(r.sales), money(r.gst), money(r.exGst), r.orders, money(r.stripeSales), money(r.stripeFees), money(r.stripeNet), r.partial ? 'yes' : '']),
  ])
  return { quarters, months, year, firstData, csv }
}

// ---------- Helpers ----------

/** Percentage change, or null when there is nothing to compare with */
export function change(now: number, before: number): number | null {
  if (!before) return null
  return (now - before) / before
}

/** A round tick step so that 4 steps cover the largest value (e.g. 200, 1.5K, 2.5K) */
export function niceStep(max: number, steps = 4): number {
  if (max <= 0) return 1
  const raw = max / steps
  const power = 10 ** Math.floor(Math.log10(raw))
  return [1, 1.5, 2, 2.5, 3, 5, 10].find((s) => s * power >= raw)! * power
}

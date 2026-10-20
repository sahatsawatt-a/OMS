import { GST_RATE } from './mockData'
import type { OrderItem } from './types'

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })
const audWhole = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })

/** Format an amount in cents as AUD; whole dollars are shown without decimals */
export function formatAUD(cents: number): string {
  return cents % 100 === 0 ? audWhole.format(cents / 100) : aud.format(cents / 100)
}

/** Total of the items that were not cancelled, in cents */
export function itemsTotal(items: OrderItem[]): number {
  return items.filter((i) => i.status !== 'cancelled').reduce((n, i) => n + i.unitPrice * i.quantity, 0)
}

/** GST included in a GST-inclusive amount (1/11 at 10%) */
export function gstIncluded(amount: number): number {
  return Math.round((amount * GST_RATE) / (1 + GST_RATE))
}

import { GST_RATE } from './mockData'
import type { Order } from './types'

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })
const audWhole = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })

/** Format an amount in cents as AUD; whole dollars are shown without decimals */
export function formatAUD(cents: number): string {
  return cents % 100 === 0 ? audWhole.format(cents / 100) : aud.format(cents / 100)
}

export type Bill = {
  subtotal: number
  /** GST already included in the subtotal (prices are GST-inclusive) */
  gst: number
  total: number
  itemCount: number
}

export function calculateBill(orders: Order[]): Bill {
  let subtotal = 0
  let itemCount = 0
  for (const order of orders) {
    for (const item of order.items) {
      if (item.status === 'cancelled') continue
      subtotal += item.unitPrice * item.quantity
      itemCount += item.quantity
    }
  }
  const gst = Math.round((subtotal * GST_RATE) / (1 + GST_RATE))
  return { subtotal, gst, total: subtotal, itemCount }
}

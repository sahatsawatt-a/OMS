import { SERVICE_CHARGE_RATE, VAT_RATE } from './mockData'
import type { Order } from './types'

const thb = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' })
const thbWhole = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })

/** Format an amount in satang as THB; whole baht are shown without decimals */
export function formatTHB(satang: number): string {
  return satang % 100 === 0 ? thbWhole.format(satang / 100) : thb.format(satang / 100)
}

export type Bill = {
  subtotal: number
  serviceCharge: number
  vat: number
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
  const serviceCharge = Math.round(subtotal * SERVICE_CHARGE_RATE)
  const vat = Math.round((subtotal + serviceCharge) * VAT_RATE)
  return { subtotal, serviceCharge, vat, total: subtotal + serviceCharge + vat, itemCount }
}

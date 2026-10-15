// Sample restaurant state so the demo has something on every screen from the start.
// Times are relative to when the demo is seeded (first load or "Reset to sample data").
import { randomToken, shortId } from './ids'
import { DEFAULT_MENU_BY_ID, defaultMenu, TABLES } from './mockData'
import type { DemoState, ItemStatus, Order, OrderItem, SelectedOption, TableSession } from './types'

const MIN = 60 * 1000

export const emptyState = (): DemoState => ({ sessions: {}, orders: [], soldOut: [], menu: defaultMenu() })

/** Build an order item from a menu id, picking options by choice name */
function item(menuItemId: string, quantity: number, status: ItemStatus, choices: string[] = [], note = ''): OrderItem {
  const menu = DEFAULT_MENU_BY_ID[menuItemId]
  const options: SelectedOption[] = (menu.optionGroups ?? []).flatMap((g) =>
    g.choices.filter((c) => choices.includes(c.name)).map((c) => ({ groupName: g.name, choiceName: c.name, price: c.price })),
  )
  return {
    id: shortId(),
    menuItemId,
    name: menu.name,
    unitPrice: menu.price + options.reduce((n, o) => n + o.price, 0),
    quantity,
    options,
    note,
    status,
  }
}

export function seedState(now = Date.now()): DemoState {
  const sessions: Record<string, TableSession> = {}
  const orders: Order[] = []

  const seat = (tableNumber: number, guests: number, minutesAgo: number, extra: Partial<TableSession> = {}) => {
    const table = TABLES.find((t) => t.number === tableNumber)!
    const session: TableSession = {
      token: randomToken(),
      tableId: table.id,
      tableNumber,
      guests,
      status: 'open',
      openedAt: now - minutesAgo * MIN,
      ...extra,
    }
    sessions[session.token] = session
    return session
  }

  const order = (session: TableSession, minutesAgo: number, items: OrderItem[]) => {
    orders.push({
      id: shortId(),
      sessionToken: session.token,
      tableNumber: session.tableNumber,
      round: orders.filter((o) => o.sessionToken === session.token).length + 1,
      createdAt: now - minutesAgo * MIN,
      items,
    })
  }

  // Table 1: earlier guests, already paid and gone (closed session)
  const t1 = seat(1, 2, 95, { status: 'closed', closedAt: now - 40 * MIN })
  order(t1, 90, [item('som-tam', 1, 'served', ['Medium']), item('khao-man-gai', 2, 'served'), item('lime-soda', 2, 'served', ['Normal'])])
  t1.payment = { method: 'cash', amount: 0, paidAt: now - 40 * MIN }

  // Table 2: just ordered, nothing started yet; they are calling a waiter
  const t2 = seat(2, 2, 8, { waiterCalledAt: now - 1 * MIN })
  order(t2, 4, [
    item('pad-thai', 1, 'submitted', ['Shrimp', 'Medium']),
    item('pad-see-ew', 1, 'submitted', ['Chicken']),
    item('thai-tea', 2, 'submitted', ['Less sweet']),
  ])

  // Table 3: second round is cooking (and running late), one dish ready to serve
  const t3 = seat(3, 4, 38)
  order(t3, 34, [
    item('spring-rolls', 1, 'served'),
    item('satay', 1, 'served'),
    item('singha', 2, 'served'),
    item('thai-tea', 2, 'served', ['Normal']),
  ])
  order(t3, 14, [
    item('green-curry', 1, 'preparing', ['Chicken', 'Mild']),
    item('kra-pao', 2, 'preparing', ['Pork', 'Thai hot', 'Fried egg'], 'no green beans'),
    item('khao-man-gai', 1, 'ready'),
  ])

  // Table 5: finished eating, one item was cancelled, asked for the bill
  const t5 = seat(5, 3, 72, { billRequestedAt: now - 2 * MIN })
  order(t5, 68, [
    item('tom-yum', 1, 'served', ['Medium']),
    item('massaman', 1, 'served'),
    item('pineapple-rice', 1, 'served', ['Shrimp']),
    item('boat-noodles', 1, 'cancelled', ['Mild']),
    item('singha', 3, 'served'),
  ])
  order(t5, 25, [item('mango-sticky-rice', 2, 'served'), item('coconut-ice-cream', 1, 'served')])

  // Table 6: drinks out, mains just started
  const t6 = seat(6, 5, 20)
  order(t6, 17, [item('lime-soda', 3, 'served', ['Normal']), item('singha', 2, 'served')])
  order(t6, 6, [
    item('pad-thai', 2, 'preparing', ['Chicken', 'Not spicy']),
    item('tom-yum', 1, 'preparing', ['Thai hot']),
    item('som-tam', 1, 'submitted', ['Mild'], 'peanuts on the side'),
  ])

  // Table 7: a big group just sat down, nothing ordered yet
  seat(7, 6, 2)

  // Table 1's paid amount equals its bill (computed here to stay consistent with the menu)
  t1.payment.amount = orders
    .filter((o) => o.sessionToken === t1.token)
    .flatMap((o) => o.items)
    .reduce((n, i) => n + i.unitPrice * i.quantity, 0)

  return { sessions, orders, soldOut: ['coconut', 'massaman'], menu: defaultMenu() }
}

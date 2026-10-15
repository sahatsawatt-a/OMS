import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatElapsed, useNow } from '../../components/format'
import { Icon } from '../../components/Icon'
import { KITCHEN_LATE_AFTER_MS } from '../../demo/mockData'
import { actions, useDemoState } from '../../demo/store'
import type { ItemStatus, Order } from '../../demo/types'
import './kitchen.css'

const COLUMNS: { status: ItemStatus; title: string; next?: ItemStatus; action?: string }[] = [
  { status: 'submitted', title: 'New', next: 'preparing', action: 'Start' },
  { status: 'preparing', title: 'Cooking', next: 'ready', action: 'Ready' },
  { status: 'ready', title: 'Ready to serve' },
]

export default function KitchenPage() {
  const demo = useDemoState()
  const now = useNow(10000)
  const [showMenu, setShowMenu] = useState(false)

  // Only orders from open sessions, oldest first
  const openTokens = new Set(Object.values(demo.sessions).filter((s) => s.status === 'open').map((s) => s.token))
  const orders = demo.orders.filter((o) => openTokens.has(o.sessionToken)).sort((a, b) => a.createdAt - b.createdAt)

  return (
    <div className="kitchen">
      <header className="topbar topbar-dark">
        <Link to="/" className="brand">
          OMS
        </Link>
        <span className="topbar-title">Kitchen display</span>
        <nav>
          <button className="btn btn-sm btn-ghost-light" onClick={() => setShowMenu((s) => !s)}>
            {showMenu ? 'Hide menu list' : `Sold-out items (${demo.soldOut.length})`}
          </button>
          <Link to="/staff">
            Front of house <Icon name="arrowRight" size={16} />
          </Link>
        </nav>
      </header>

      <div className="kitchen-body">
        <div className="kds-columns">
          {COLUMNS.map((col) => {
            const tickets = orders
              .map((o) => ({ order: o, items: o.items.filter((i) => i.status === col.status) }))
              .filter((t) => t.items.length > 0)
            return (
              <section key={col.status} className="kds-column">
                <h2>
                  {col.title} <span className="count">{tickets.reduce((n, t) => n + t.items.length, 0)}</span>
                </h2>
                {tickets.length === 0 && <p className="kds-empty">Nothing here</p>}
                {tickets.map(({ order, items }) => (
                  <Ticket key={order.id} order={order} items={items} now={now} column={col} />
                ))}
              </section>
            )
          })}
        </div>

        {showMenu && (
          <aside className="availability">
            <h2>Menu availability</h2>
            <p className="muted small">Tap to mark an item sold out. Diners see it straight away.</p>
            {demo.menu.categories.map((c) => (
              <div key={c.id}>
                <h3>{c.name}</h3>
                {demo.menu.items.filter((m) => m.categoryId === c.id && !m.hidden).map((m) => {
                  const out = demo.soldOut.includes(m.id)
                  return (
                    <label key={m.id} className={`avail-row ${out ? 'out' : ''}`}>
                      <span>
                        {m.name}
                      </span>
                      <input type="checkbox" checked={!out} onChange={() => actions.toggleSoldOut(m.id)} />
                      <span className="avail-state">{out ? 'Sold out' : 'Available'}</span>
                    </label>
                  )
                })}
              </div>
            ))}
          </aside>
        )}
      </div>
    </div>
  )
}

function Ticket({
  order,
  items,
  now,
  column,
}: {
  order: Order
  items: Order['items']
  now: number
  column: (typeof COLUMNS)[number]
}) {
  const late = column.status !== 'ready' && now - order.createdAt > KITCHEN_LATE_AFTER_MS
  return (
    <article className={`ticket ${late ? 'late' : ''}`}>
      <header className="ticket-header">
        <span className="ticket-table">Table {order.tableNumber}</span>
        <span className="ticket-time">
          R{order.round} · {formatElapsed(order.createdAt, now)}
        </span>
      </header>
      <ul>
        {items.map((i) => (
          <li key={i.id} className="ticket-item">
            <div className="grow">
              <div>
                <strong>{i.quantity}×</strong> {i.name}
              </div>
              {i.options.length > 0 && <div className="ticket-opts">{i.options.map((o) => o.choiceName).join(' · ')}</div>}
              {i.note && <div className="ticket-note">“{i.note}”</div>}
            </div>
            {column.next && (
              <button className="btn btn-sm" onClick={() => actions.setItemStatus(order.id, i.id, column.next!)}>
                {column.action}
              </button>
            )}
          </li>
        ))}
      </ul>
      {column.next && items.length > 1 && (
        <button className="btn btn-sm btn-block ticket-all" onClick={() => actions.advanceOrder(order.id, column.status, column.next!)}>
          {column.action} all
        </button>
      )}
      {!column.next && <div className="ticket-waiting">Waiting for a waiter</div>}
    </article>
  )
}

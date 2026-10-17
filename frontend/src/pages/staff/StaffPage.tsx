import { QRCodeSVG } from 'qrcode.react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatElapsed, formatTime, sessionUrl, useNow } from '../../components/format'
import { Icon } from '../../components/Icon'
import { Sheet, StatusBadge } from '../../components/shared'
import { useMediaQuery } from '../../components/useMediaQuery'
import { SignOutButton } from '../../components/StaffGate'
import { RESTAURANT_NAME } from '../../demo/mockData'
import { formatAUD, gstIncluded } from '../../demo/money'
import { actions, useDemoState } from '../../demo/store'
import type { Order, Table, TableSession } from '../../demo/types'
import './staff.css'

type TableView = {
  table: Table
  session?: TableSession
  orders: Order[]
  state: 'free' | 'seated' | 'pay' | 'serve'
}

/** Paid orders with food not yet brought to the table */
const toServe = (orders: Order[]) =>
  orders.filter((o) => o.payment.status === 'paid' && o.items.some((i) => i.status !== 'served' && i.status !== 'cancelled'))
const paidTotal = (orders: Order[]) => orders.filter((o) => o.payment.status === 'paid').reduce((n, o) => n + o.payment.amount, 0)

const STATE_LABEL: Record<TableView['state'], string> = { free: 'Free', seated: 'Seated', pay: 'Pay at counter', serve: 'Food to serve' }

export default function StaffPage() {
  const demo = useDemoState()
  const now = useNow()
  const [opening, setOpening] = useState<Table | null>(null)
  const [qrFor, setQrFor] = useState<TableSession | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const views: TableView[] = useMemo(
    () =>
      demo.tables.map((table) => {
        const session = Object.values(demo.sessions).find((s) => s.tableId === table.id && s.status === 'open')
        const orders = session ? demo.orders.filter((o) => o.sessionToken === session.token) : []
        const waiting = orders.some((o) => o.payment.status === 'awaiting_counter')
        const state: TableView['state'] = !session ? 'free' : waiting ? 'pay' : toServe(orders).length ? 'serve' : 'seated'
        return { table, session, orders, state }
      }),
    [demo],
  )

  const waiterCalls = views.flatMap((v) =>
    v.session?.waiterCalledAt ? [{ token: v.session.token, table: v.table.number, at: v.session.waiterCalledAt }] : [],
  )
  // Orders where the guest chose "Pay at counter" and is waiting to pay
  const counterPayments = demo.orders
    .filter((o) => o.payment.status === 'awaiting_counter' && demo.sessions[o.sessionToken]?.status === 'open')
    .sort((a, b) => a.createdAt - b.createdAt)

  const selectedView = views.find((v) => v.session?.token === selected)
  // Wide screens: alerts live in the side panel; phones: a compact list above the tables
  const narrow = useMediaQuery('(max-width: 820px)')
  const attention = counterPayments.length + waiterCalls.length
  const seated = views.filter((v) => v.session)
  const guests = seated.reduce((n, v) => n + (v.session?.guests ?? 0), 0)

  // Counter payments to take and waiter calls, oldest first
  const attentionList = (
    <div className="alerts">
          {counterPayments.map((o) => (
        <div key={o.id} className="alert alert-pay">
          <Icon name="cash" />
          <span className="grow">
            <strong>Order #{o.number}</strong> · Table {o.tableNumber} · {formatAUD(o.payment.amount)} to pay at the counter ·{' '}
            {formatElapsed(o.createdAt, now)}
          </span>
          <div className="row gap">
            <button className="btn btn-sm" onClick={() => actions.confirmCounterPayment(o.id, 'card_terminal')}>
              Card
            </button>
            <button className="btn btn-sm" onClick={() => actions.confirmCounterPayment(o.id, 'cash')}>
              Cash
            </button>
          </div>
        </div>
      ))}
      {waiterCalls.map((a) => (
        <div key={a.token} className="alert alert-waiter">
          <Icon name="bell" />
          <span className="grow">
            <strong>Table {a.table}</strong> is calling a waiter · {formatElapsed(a.at, now)}
          </span>
          <button className="btn btn-sm" onClick={() => actions.acknowledgeWaiter(a.token)}>
            Got it
          </button>
        </div>
      ))}
    </div>
  )

  return (
    <div className="staff">
      <header className="topbar">
        <Link to="/" className="brand">
          OMS
        </Link>
        <span className="topbar-title">Front of house</span>
        <nav>
          <Link to="/admin">
            Menu admin <Icon name="arrowRight" size={16} />
          </Link>
          <SignOutButton />
        </nav>
      </header>

      <div className="staff-body">
        <div className="staff-main">
          {narrow && attention > 0 && attentionList}
          <main className="table-grid">
          {views.map((v) => {
            const paid = paidTotal(v.orders)
            return (
              <button
                key={v.table.id}
                className={`table-card state-${v.state} ${selected && v.session?.token === selected ? 'selected' : ''}`}
                onClick={() => (v.session ? setSelected(v.session.token) : setOpening(v.table))}
              >
                <div className="table-top">
                  <span className="table-number">{v.table.number}</span>
                  <span className="table-state">
                    {STATE_LABEL[v.state]}
                  </span>
                </div>
                <div className="table-meta">
                  {v.table.zone} · {v.table.seats} seats
                </div>
                {v.session ? (
                  <div className="table-bottom">
                    <span>
                      {v.session.guests} guests · {formatElapsed(v.session.openedAt, now).replace(' ago', '')}
                    </span>
                    {v.orders.length ? <strong>{formatAUD(paid)} paid</strong> : <span>No orders yet</span>}
                  </div>
                ) : (
                  <div className="table-bottom muted">Tap to seat guests</div>
                )}
              </button>
            )
          })}
          </main>
        </div>

        {selectedView?.session ? (
          <TableDetail
            view={selectedView}
            attention={narrow ? 0 : attention}
            onShowQr={() => setQrFor(selectedView.session!)}
            onClose={() => setSelected(null)}
          />
        ) : (
          !narrow && (
            <aside className="detail detail-idle" aria-label="Needs attention">
              <header className="detail-header">
                <div>
                  <h2>Needs attention</h2>
                  <div className="muted small">
                    {seated.length} of {views.length} tables seated · {guests} {guests === 1 ? 'guest' : 'guests'}
                  </div>
                </div>
              </header>
              {attention > 0 ? (
                attentionList
              ) : (
                <p className="muted small attention-empty">
                  Nothing waiting. Counter payments and waiter calls appear here; tap a table to see its orders.
                </p>
              )}
            </aside>
          )
        )}
      </div>

      {opening && (
        <OpenSessionSheet
          table={opening}
          onClose={() => setOpening(null)}
          onOpen={async (guests) => {
            const session = await actions.openSession(opening.id, guests)
            setOpening(null)
            if (!session) return
            setSelected(session.token)
            setQrFor(session)
          }}
        />
      )}

      {qrFor && <QrSheet session={qrFor} onClose={() => setQrFor(null)} />}
    </div>
  )
}

function OpenSessionSheet({ table, onClose, onOpen }: { table: Table; onClose: () => void; onOpen: (guests: number) => Promise<void> }) {
  const [guests, setGuests] = useState(Math.min(2, table.seats))
  const [opening, setOpening] = useState(false)
  return (
    <Sheet
      title={`Seat guests at Table ${table.number}`}
      onClose={onClose}
      footer={
        <button
          className="btn btn-primary btn-block"
          disabled={opening}
          onClick={() => {
            setOpening(true)
            void onOpen(guests)
          }}
        >
          {opening ? 'Opening…' : 'Open session & generate QR'}
        </button>
      }
    >
      <p className="muted">How many guests?</p>
      <div className="guest-picker">
        {Array.from({ length: table.seats }, (_, i) => i + 1).map((n) => (
          <button key={n} className={guests === n ? 'active' : ''} onClick={() => setGuests(n)}>
            {n}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function QrSheet({ session, onClose }: { session: TableSession; onClose: () => void }) {
  const url = sessionUrl(session.tableNumber, session.token)
  return (
    <Sheet
      title={`Table ${session.tableNumber} QR code`}
      onClose={onClose}
      footer={
        <div className="row gap">
          <button className="btn btn-outline grow" onClick={() => window.print()}>
            <Icon name="printer" /> Print
          </button>
          <a className="btn btn-primary grow" href={url} target="_blank" rel="noreferrer">
            Customer view <Icon name="arrowUpRight" size={16} />
          </a>
        </div>
      }
    >
      <div className="qr-print">
        <div className="qr-brand">{RESTAURANT_NAME}</div>
        <div className="qr-title">Table {session.tableNumber}</div>
        <div className="qr-box">
          <QRCodeSVG value={url} size={220} marginSize={2} />
        </div>
        <div className="qr-caption">Scan to see the menu and order</div>
      </div>
      <div className="qr-details">
        <div>
          <span className="muted">Session</span> <code>{session.token}</code>
        </div>
        <div className="qr-url">
          <span className="muted">Link</span> <code>{url}</code>
        </div>
        <p className="muted small">
          The table number is for reference; orders are routed by the session token. A phone can only reach this
          link if <code>VITE_PUBLIC_BASE_URL</code> points at an address it can open (the public demo link, or your LAN IP).
        </p>
      </div>
    </Sheet>
  )
}

function TableDetail({
  view,
  attention,
  onShowQr,
  onClose,
}: {
  view: TableView
  /** Counter payments and waiter calls waiting elsewhere; closing the table shows them */
  attention: number
  onShowQr: () => void
  onClose: () => void
}) {
  const session = view.session!
  const now = useNow()
  const paid = paidTotal(view.orders)
  const unpaid = view.orders.some((o) => o.payment.status === 'awaiting_counter')

  return (
    <aside className="detail">
      {attention > 0 && (
        <button className="attention-link" onClick={onClose}>
          <Icon name="bell" size={15} />
          {attention} {attention === 1 ? 'thing needs' : 'things need'} attention
          <Icon name="arrowRight" size={15} />
        </button>
      )}
      <header className="detail-header">
        <div>
          <h2>Table {session.tableNumber}</h2>
          <div className="muted small">
            {session.guests} guests · seated {formatTime(session.openedAt)} ({formatElapsed(session.openedAt, now)})
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <Icon name="x" />
        </button>
      </header>

      <div className="row gap wrap">
        <button className="btn btn-outline btn-sm" onClick={onShowQr}>
          <Icon name="qr" size={16} /> Show QR
        </button>
        <a className="btn btn-outline btn-sm" href={sessionUrl(session.tableNumber, session.token)} target="_blank" rel="noreferrer">
          Order for guests <Icon name="arrowUpRight" size={16} />
        </a>
      </div>

      <div className="detail-orders">
        {view.orders.length === 0 && <p className="muted">No orders yet.</p>}
        {[...view.orders].reverse().map((o) => {
          const unserved = o.items.filter((i) => i.status !== 'served' && i.status !== 'cancelled')
          return (
            <section key={o.id} className={`card order-card pay-${o.payment.status}`}>
              <div className="row between">
                <strong>Order #{o.number}</strong>
                <span className="muted small">{formatTime(o.createdAt)}</span>
              </div>
              <div className={`order-pay-line pay-${o.payment.status}`}>
                {o.payment.status === 'paid'
                  ? `Paid ${o.payment.method === 'stripe' ? 'on phone' : o.payment.method === 'cash' ? 'in cash' : 'by card'} · ${formatAUD(o.payment.amount)}`
                  : o.payment.status === 'awaiting_counter'
                    ? `Waiting for payment at counter · ${formatAUD(o.payment.amount)}`
                    : 'Cancelled, not paid'}
              </div>
              <ul className="line-list">
                {o.items.map((i) => (
                  <li key={i.id} className={`line ${i.status === 'cancelled' ? 'struck' : ''}`}>
                    <div className="grow">
                      <div className="line-name">
                        {i.quantity} × {i.name}
                      </div>
                      {(i.options.length > 0 || i.note) && (
                        <div className="muted small">
                          {[...i.options.map((x) => x.choiceName), i.note && `“${i.note}”`].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                    {o.payment.status === 'awaiting_counter' ? (
                      <span className="muted small">Not paid</span>
                    ) : (
                      <>
                        <StatusBadge status={i.status} />
                        {o.payment.status === 'paid' && i.status !== 'served' && i.status !== 'cancelled' && (
                          <button className="btn btn-sm btn-outline" onClick={() => actions.setItemStatus(o.id, i.id, 'served')}>
                            Served
                          </button>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {o.payment.status === 'awaiting_counter' && (
                <div className="row gap wrap order-actions">
                  <button className="btn btn-sm btn-primary" onClick={() => actions.confirmCounterPayment(o.id, 'card_terminal')}>
                    <Icon name="card" size={15} /> Paid by card
                  </button>
                  <button className="btn btn-sm btn-primary" onClick={() => actions.confirmCounterPayment(o.id, 'cash')}>
                    <Icon name="cash" size={15} /> Paid in cash
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      if (confirm(`Cancel order #${o.number}? It was never paid, so nothing will be made.`)) actions.cancelUnpaidOrder(o.id)
                    }}
                  >
                    Cancel order
                  </button>
                </div>
              )}
              {o.payment.status === 'paid' && unserved.length > 1 && (
                <button className="btn btn-sm btn-outline btn-block order-actions" onClick={() => actions.markOrderServed(o.id)}>
                  Mark all served
                </button>
              )}
            </section>
          )
        })}
      </div>

      <footer className="detail-footer">
        <div className="row between total">
          <span>Paid this visit</span>
          <span>{formatAUD(paid)}</span>
        </div>
        <div className="muted">Includes GST {formatAUD(gstIncluded(paid))}</div>
        <button
          className="btn btn-outline btn-block"
          disabled={unpaid}
          title={unpaid ? 'An order is still waiting for payment' : undefined}
          onClick={async () => {
            if (confirm(`Clear table ${session.tableNumber}? Its QR code will stop working.`) && (await actions.clearTable(session.token))) onClose()
          }}
        >
          Clear table (guests have left)
        </button>
        {unpaid && <p className="muted small clear-note">Take or cancel the counter payment before clearing the table.</p>}
      </footer>
    </aside>
  )
}

import { QRCodeSVG } from 'qrcode.react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatElapsed, formatTime, sessionUrl, useNow } from '../../components/format'
import { Icon } from '../../components/Icon'
import { Sheet, StatusBadge } from '../../components/shared'
import { RESTAURANT_NAME, TABLES } from '../../demo/mockData'
import { calculateBill, formatTHB } from '../../demo/money'
import { actions, useDemoState } from '../../demo/store'
import type { Order, PaymentMethod, Table, TableSession } from '../../demo/types'
import './staff.css'

type TableView = {
  table: Table
  session?: TableSession
  orders: Order[]
  state: 'free' | 'seated' | 'ready' | 'bill'
}

export default function StaffPage() {
  const demo = useDemoState()
  const now = useNow()
  const [opening, setOpening] = useState<Table | null>(null)
  const [qrFor, setQrFor] = useState<TableSession | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const views: TableView[] = useMemo(
    () =>
      TABLES.map((table) => {
        const session = Object.values(demo.sessions).find((s) => s.tableId === table.id && s.status === 'open')
        const orders = session ? demo.orders.filter((o) => o.sessionToken === session.token) : []
        const hasReady = orders.some((o) => o.items.some((i) => i.status === 'ready'))
        const state = !session ? 'free' : session.billRequestedAt ? 'bill' : hasReady ? 'ready' : 'seated'
        return { table, session, orders, state }
      }),
    [demo],
  )

  const alerts = views.flatMap((v) => {
    if (!v.session) return []
    const list: { token: string; table: number; kind: 'waiter' | 'bill'; at: number }[] = []
    if (v.session.waiterCalledAt) list.push({ token: v.session.token, table: v.table.number, kind: 'waiter', at: v.session.waiterCalledAt })
    if (v.session.billRequestedAt) list.push({ token: v.session.token, table: v.table.number, kind: 'bill', at: v.session.billRequestedAt })
    return list
  })

  const selectedView = views.find((v) => v.session?.token === selected)

  return (
    <div className="staff">
      <header className="topbar">
        <Link to="/" className="brand">
          OMS
        </Link>
        <span className="topbar-title">Front of house</span>
      </header>

      {alerts.length > 0 && (
        <div className="alerts">
          {alerts.map((a) => (
            <div key={`${a.token}-${a.kind}`} className={`alert alert-${a.kind}`}>
              <Icon name={a.kind === 'waiter' ? 'bell' : 'receipt'} />
              <span className="grow">
                <strong>Table {a.table}</strong> {a.kind === 'waiter' ? 'is calling a waiter' : 'asked for the bill'} ·{' '}
                {formatElapsed(a.at, now)}
              </span>
              <button className="btn btn-sm" onClick={() => actions.acknowledge(a.token, a.kind)}>
                Got it
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="staff-body">
        <main className="table-grid">
          {views.map((v) => {
            const bill = calculateBill(v.orders)
            return (
              <button
                key={v.table.id}
                className={`table-card state-${v.state} ${selected && v.session?.token === selected ? 'selected' : ''}`}
                onClick={() => (v.session ? setSelected(v.session.token) : setOpening(v.table))}
              >
                <div className="table-top">
                  <span className="table-number">{v.table.number}</span>
                  <span className="table-state">
                    {v.state === 'free' ? 'Free' : v.state === 'bill' ? 'Bill requested' : v.state === 'ready' ? 'Ready to serve' : 'Seated'}
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
                    {bill.total > 0 ? <strong>{formatTHB(bill.total)}</strong> : <span>No orders yet</span>}
                  </div>
                ) : (
                  <div className="table-bottom muted">Tap to seat guests</div>
                )}
              </button>
            )
          })}
        </main>

        {selectedView?.session && (
          <TableDetail
            view={selectedView}
            onShowQr={() => setQrFor(selectedView.session!)}
            onClose={() => setSelected(null)}
          />
        )}
      </div>

      {opening && (
        <OpenSessionSheet
          table={opening}
          onClose={() => setOpening(null)}
          onOpen={(guests) => {
            const session = actions.openSession(opening.id, guests)
            setOpening(null)
            setSelected(session.token)
            setQrFor(session)
          }}
        />
      )}

      {qrFor && <QrSheet session={qrFor} onClose={() => setQrFor(null)} />}
    </div>
  )
}

function OpenSessionSheet({ table, onClose, onOpen }: { table: Table; onClose: () => void; onOpen: (guests: number) => void }) {
  const [guests, setGuests] = useState(Math.min(2, table.seats))
  return (
    <Sheet
      title={`Seat guests at Table ${table.number}`}
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" onClick={() => onOpen(guests)}>
          Open session & generate QR
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
          link if <code>VITE_PUBLIC_BASE_URL</code> points at an address it can open (e.g. your LAN IP).
        </p>
      </div>
    </Sheet>
  )
}

function TableDetail({ view, onShowQr, onClose }: { view: TableView; onShowQr: () => void; onClose: () => void }) {
  const session = view.session!
  const now = useNow()
  const bill = calculateBill(view.orders)
  const [settling, setSettling] = useState(false)

  return (
    <aside className="detail">
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
        {view.orders.map((o) => (
          <section key={o.id} className="card">
            <div className="row between">
              <strong>Round {o.round}</strong>
              <span className="muted small">{formatTime(o.createdAt)}</span>
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
                  <StatusBadge status={i.status} />
                  {i.status === 'ready' && (
                    <button className="btn btn-sm btn-primary" onClick={() => actions.setItemStatus(o.id, i.id, 'served')}>
                      Served
                    </button>
                  )}
                  {i.status === 'submitted' && (
                    <button className="btn btn-sm btn-ghost" onClick={() => actions.setItemStatus(o.id, i.id, 'cancelled')}>
                      Cancel
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="detail-footer">
        <div className="row between">
          <span className="muted">
            Subtotal {formatTHB(bill.subtotal)} + service {formatTHB(bill.serviceCharge)} + VAT {formatTHB(bill.vat)}
          </span>
        </div>
        <div className="row between total">
          <span>Total</span>
          <span>{formatTHB(bill.total)}</span>
        </div>
        <button className="btn btn-primary btn-block" onClick={() => setSettling(true)}>
          Settle bill & close table
        </button>
      </footer>

      {settling && (
        <SettleSheet
          tableNumber={session.tableNumber}
          amount={bill.total}
          onClose={() => setSettling(false)}
          onSettle={(method) => {
            actions.settle(session.token, method, bill.total)
            setSettling(false)
            onClose()
          }}
        />
      )}
    </aside>
  )
}

function SettleSheet({
  tableNumber,
  amount,
  onClose,
  onSettle,
}: {
  tableNumber: number
  amount: number
  onClose: () => void
  onSettle: (m: PaymentMethod) => void
}) {
  return (
    <Sheet title={`Settle Table ${tableNumber}`} onClose={onClose}>
      <div className="settle-amount">{formatTHB(amount)}</div>
      <p className="muted small">How did the guests pay? Closing the session frees the table and its QR stops working.</p>
      <div className="settle-methods">
        <button className="btn btn-outline" onClick={() => onSettle('cash')}>
          <Icon name="cash" /> Cash
        </button>
        <button className="btn btn-outline" onClick={() => onSettle('card_terminal')}>
          <Icon name="card" /> Card terminal
        </button>
        <button className="btn btn-outline" onClick={() => onSettle('stripe')}>
          <Icon name="phone" /> Paid by phone (Stripe)
        </button>
      </div>
    </Sheet>
  )
}

import { QRCodeSVG } from 'qrcode.react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CARD_BRAND_LABEL, CARD_BRANDS, formatElapsed, formatTime, paidBy, sessionUrl, useNow } from '../../components/format'
import { Icon } from '../../components/Icon'
import { Sheet, StatusBadge } from '../../components/shared'
import { useMediaQuery } from '../../components/useMediaQuery'
import { SignOutButton } from '../../components/StaffGate'
import { RESTAURANT_NAME } from '../../demo/mockData'
import { formatAUD, gstIncluded } from '../../demo/money'
import { actions, useDemoState } from '../../demo/store'
import type { CardBrand, Order, Table, TableSession } from '../../demo/types'
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
  // The counter order being paid, by id so the sheet follows live updates
  const [payingId, setPayingId] = useState<string | null>(null)
  const paying = demo.orders.find((o) => o.id === payingId && o.payment.status === 'awaiting_counter')

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
    v.session?.waiterCalledAt ? [{ id: v.session.id, table: v.table.number, at: v.session.waiterCalledAt }] : [],
  )
  // Orders where the guest chose "Pay at counter" and is waiting to pay
  const counterPayments = demo.orders
    .filter((o) => o.payment.status === 'awaiting_counter' && !!o.sessionToken && demo.sessions[o.sessionToken]?.status === 'open')
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
            <strong>Order #{o.number}</strong> · Table {o.tableNumber}
            {o.device && ` · Phone ${o.device}`} · {formatAUD(o.payment.amount)} to pay at the counter ·{' '}
            {formatElapsed(o.createdAt, now)}
          </span>
          <button className="btn btn-sm" onClick={() => setPayingId(o.id)}>
            Take payment
          </button>
        </div>
      ))}
      {waiterCalls.map((a) => (
        <div key={a.id} className="alert alert-waiter">
          <Icon name="bell" />
          <span className="grow">
            <strong>Table {a.table}</strong> is calling a waiter · {formatElapsed(a.at, now)}
          </span>
          <button className="btn btn-sm" onClick={() => actions.acknowledgeWaiter(a.id)}>
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
                    <span className={tooManyPhones(v.session) ? 'phones-over' : ''}>
                      {v.session.guests} guests ·{' '}
                      {activePhones(v.session).length > 0 && `${activePhones(v.session).length} ${activePhones(v.session).length === 1 ? 'phone' : 'phones'} · `}
                      {formatElapsed(v.session.openedAt, now).replace(' ago', '')}
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
            onTakePayment={(o) => setPayingId(o.id)}
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
      {paying && <TakePaymentSheet order={paying} onClose={() => setPayingId(null)} />}
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

/** Take a counter payment: an optional discount ($ or %), cash or card, and the card brand for the record */
function TakePaymentSheet({ order, onClose }: { order: Order; onClose: () => void }) {
  const [unit, setUnit] = useState<'$' | '%'>('$')
  const [value, setValue] = useState('')
  const [method, setMethod] = useState<'card_terminal' | 'cash'>('card_terminal')
  const [brand, setBrand] = useState<CardBrand | undefined>()
  const [saving, setSaving] = useState(false)

  const bill = order.payment.amount
  const n = Number(value) || 0
  const discount = Math.round(unit === '$' ? n * 100 : (bill * n) / 100)
  const tooMuch = n < 0 || discount > bill
  const toPay = bill - Math.max(0, discount)
  // A card payment needs its type: the Payments report splits Visa, Mastercard, ... (REQ-39)
  const needsBrand = method === 'card_terminal' && !brand

  return (
    <Sheet
      title={`Take payment · Order #${order.number} · Table ${order.tableNumber}`}
      onClose={onClose}
      footer={
        <button
          className="btn btn-primary btn-block"
          disabled={saving || tooMuch || needsBrand}
          onClick={async () => {
            setSaving(true)
            const ok = await actions.confirmCounterPayment(order.id, {
              method,
              discount: discount || undefined,
              cardBrand: method === 'card_terminal' ? brand : undefined,
            })
            if (ok) onClose()
            else setSaving(false)
          }}
        >
          {saving ? 'Saving…' : `Confirm payment ${formatAUD(toPay)}`}
        </button>
      }
    >
      <div className="pay-bill">
        <div className="row between">
          <span>Bill</span>
          <span>{formatAUD(bill)}</span>
        </div>
        <div className="field">
          <span id="discount-label">Discount</span>
          <div className="row gap">
            <div className="choice-picker unit-picker" role="radiogroup" aria-label="Discount in">
              {(['$', '%'] as const).map((u) => (
                <button key={u} role="radio" aria-checked={unit === u} className={unit === u ? 'active' : ''} onClick={() => setUnit(u)}>
                  {u}
                </button>
              ))}
            </div>
            <input
              className="grow"
              type="number"
              inputMode="decimal"
              min="0"
              step={unit === '$' ? '0.01' : '1'}
              placeholder="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-labelledby="discount-label"
            />
          </div>
        </div>
        {tooMuch && <p className="pay-error small">The discount can't be more than the bill.</p>}
        {discount > 0 && !tooMuch && (
          <div className="row between muted">
            <span>Discount</span>
            <span>−{formatAUD(discount)}</span>
          </div>
        )}
        <div className="row between total">
          <span>To pay</span>
          <span>{formatAUD(toPay)}</span>
        </div>
      </div>

      <p className="muted">Paid by</p>
      <div className="choice-picker" role="radiogroup" aria-label="Paid by">
        <button role="radio" aria-checked={method === 'card_terminal'} className={method === 'card_terminal' ? 'active' : ''} onClick={() => setMethod('card_terminal')}>
          <Icon name="card" size={16} /> Card
        </button>
        <button role="radio" aria-checked={method === 'cash'} className={method === 'cash' ? 'active' : ''} onClick={() => setMethod('cash')}>
          <Icon name="cash" size={16} /> Cash
        </button>
      </div>

      {method === 'card_terminal' && (
        <>
          <p className="muted">Card type</p>
          <div className="choice-picker" role="radiogroup" aria-label="Card type">
            {CARD_BRANDS.map((b) => (
              <button key={b} role="radio" aria-checked={brand === b} className={brand === b ? 'active' : ''} onClick={() => setBrand(b)}>
                {CARD_BRAND_LABEL[b]}
              </button>
            ))}
          </div>
          {needsBrand && <p className="muted small">Choose the card type to confirm.</p>}
        </>
      )}
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
  onTakePayment,
  onClose,
}: {
  view: TableView
  /** Counter payments and waiter calls waiting elsewhere; closing the table shows them */
  attention: number
  onShowQr: () => void
  onTakePayment: (o: Order) => void
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

      <PhonesAtTable session={session} />

      <div className="detail-orders">
        {view.orders.length === 0 && <p className="muted">No orders yet.</p>}
        {[...view.orders].reverse().map((o) => {
          const unserved = o.items.filter((i) => i.status !== 'served' && i.status !== 'cancelled')
          return (
            <section key={o.id} className={`card order-card pay-${o.payment.status}`}>
              <div className="row between">
                <strong>
                  Order #{o.number}
                  {o.device && <span className="order-phone">Phone {o.device}</span>}
                </strong>
                <span className="muted small">{formatTime(o.createdAt)}</span>
              </div>
              <div className={`order-pay-line pay-${o.payment.status}`}>
                {o.payment.status === 'paid'
                  ? `Paid ${paidBy(o.payment)} · ${formatAUD(o.payment.amount)}${o.payment.discount ? ` · ${formatAUD(o.payment.discount)} off` : ''}`
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
                  <button className="btn btn-sm btn-primary" onClick={() => onTakePayment(o)}>
                    <Icon name="cash" size={15} /> Take payment
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
            if (confirm(`Clear table ${session.tableNumber}? Its QR code will stop working.`) && (await actions.clearTable(session.id))) onClose()
          }}
        >
          Clear table (guests have left)
        </button>
        {unpaid && <p className="muted small clear-note">Take or cancel the counter payment before clearing the table.</p>}
      </footer>
    </aside>
  )
}

// ---- Phones at a table (REQ-37) ----

const activePhones = (s: TableSession) => (s.devices ?? []).filter((d) => !d.removedAt)
/** More phones than guests: maybe someone with a photo of the QR code */
const tooManyPhones = (s: TableSession) => activePhones(s).length > s.guests

function PhonesAtTable({ session }: { session: TableSession }) {
  const phones = activePhones(session)
  return (
    <section className={`card phones ${tooManyPhones(session) ? 'phones-over' : ''}`}>
      <div className="row between">
        <strong>Phones</strong>
        <span className="muted small">
          {phones.length} {phones.length === 1 ? 'phone' : 'phones'} · {session.guests} guests
        </span>
      </div>
      {tooManyPhones(session) && (
        <p className="small phones-warning">More phones than guests. If you don&apos;t recognise one, remove it.</p>
      )}
      {phones.length === 0 ? (
        <p className="muted small">No phone has scanned the QR code yet.</p>
      ) : (
        <ul className="phone-list">
          {phones.map((d) => (
            <li key={d.label}>
              <span className="phone-chip">{d.label}</span>
              <span className="muted small grow">joined {formatTime(d.joinedAt)}</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (confirm(`Remove phone ${d.label} from table ${session.tableNumber}? It stops working at once; its paid orders stay.`))
                    actions.removeDevice(session.id, d.label)
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

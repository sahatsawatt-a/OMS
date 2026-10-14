import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { formatElapsed, formatTime, useNow } from '../../components/format'
import { Icon } from '../../components/Icon'
import { Sheet, StatusBadge } from '../../components/shared'
import { useMediaQuery } from '../../components/useMediaQuery'
import { CATEGORIES, MENU, RESTAURANT_NAME, TABLES } from '../../demo/mockData'
import { calculateBill, formatTHB } from '../../demo/money'
import { allergenSentence, DIETARY_LABEL } from '../../demo/dietary'
import { PHOTO_CREDITS } from '../../demo/photoCredits'
import PaySheet from './PaySheet'
import { useStripeRedirectReturn } from './stripe'
import { actions, randomToken, useDemoState } from '../../demo/store'
import type { CartLine, MenuItem, Order, SelectedOption, TableSession } from '../../demo/types'
import './customer.css'

export default function CustomerPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('session') ?? ''
  const tableParam = Number(params.get('table'))
  const state = useDemoState()
  const session = state.sessions[token]

  if (!token) return <SessionMessage title="Scan the QR code on your table" text="Ask our staff for a QR code to start ordering." />

  if (!session) {
    // The demo keeps sessions in this browser only. A phone scanning a QR made on
    // another device will not know the session, so offer to start it locally.
    const table = TABLES.find((t) => t.number === tableParam)
    return (
      <SessionMessage
        title="Session not found on this device"
        text="In the real system this link would load your table's session from the server. In this demo, sessions live in the browser that created them."
      >
        {table && (
          <button
            className="btn btn-primary"
            onClick={() => {
              // If this browser already has an open session for the table, join that one
              const s = actions.openSession(table.id, 2, token)
              if (s.token !== token) navigate(`/order?table=${s.tableNumber}&session=${encodeURIComponent(s.token)}`, { replace: true })
            }}
          >
            Continue as Table {table.number} (demo)
          </button>
        )}
      </SessionMessage>
    )
  }

  if (session.status === 'closed') {
    return (
      <SessionMessage
        title="Thank you for dining with us!"
        text={`Table ${session.tableNumber}'s session has ended${session.payment ? ` and was paid (${formatTHB(session.payment.amount)})` : ''}. Please ask our staff if you'd like to order again.`}
      />
    )
  }

  return <OrderingApp session={session} soldOut={state.soldOut} />
}

function SessionMessage({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="customer">
      <div className="session-message">
        <div className="session-message-icon">
          <Icon name="qr" size={26} />
        </div>
        <div className="session-message-brand">{RESTAURANT_NAME}</div>
        <h1>{title}</h1>
        <p>{text}</p>
        {children}
      </div>
    </div>
  )
}

function useCart(token: string) {
  const key = `oms-cart-${token}`
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? '[]') as CartLine[]
    } catch {
      return []
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(lines))
    } catch {
      // Cart still works in memory
    }
  }, [key, lines])
  return [lines, setLines] as const
}

function OrderingApp({ session, soldOut }: { session: TableSession; soldOut: string[] }) {
  const state = useDemoState()
  const [tab, setTab] = useState<'menu' | 'orders'>('menu')
  const [category, setCategory] = useState(CATEGORIES[0].id)
  const [picking, setPicking] = useState<MenuItem | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [creditsOpen, setCreditsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searching = query.trim().length > 0
  const results = useMemo(() => searchMenu(query), [query])
  const [toast, setToast] = useState<string | null>(null)
  const [cart, setCart] = useCart(session.token)
  // iPad landscape and desktop: cart / bill stay visible in a side column
  const wide = useMediaQuery('(min-width: 1024px)')

  // Returning from a redirect-based Stripe payment method
  const settleByStripe = useCallback((amount: number) => actions.settle(session.token, 'stripe', amount), [session.token])
  useStripeRedirectReturn(session.token, settleByStripe)

  const orders = useMemo(
    () => state.orders.filter((o) => o.sessionToken === session.token),
    [state.orders, session.token],
  )
  const bill = calculateBill(orders)
  const cartCount = cart.reduce((n, l) => n + l.quantity, 0)
  const cartTotal = cart.reduce((n, l) => n + l.unitPrice * l.quantity, 0)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(id)
  }, [toast])

  // Drop cart lines that became sold out while the diner was browsing (REQ-27)
  useEffect(() => {
    if (cart.some((l) => soldOut.includes(l.menuItemId))) {
      setCart((c) => c.filter((l) => !soldOut.includes(l.menuItemId)))
      setToast('An item in your cart just sold out and was removed')
    }
  }, [soldOut, cart, setCart])

  const sendOrder = () => {
    actions.submitOrder(session.token, cart)
    setCart([])
    setCartOpen(false)
    setTab('orders')
    setToast('Order sent to the kitchen')
  }

  const requestBill = () => {
    actions.requestBill(session.token)
    setToast('We will bring your bill shortly')
  }

  const scrollTo = (id: string) => {
    setCategory(id)
    document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="customer">
      <header className="c-header">
        <div>
          <div className="c-restaurant">{RESTAURANT_NAME}</div>
          <div className="c-table">
            Table {session.tableNumber} · {session.guests} {session.guests === 1 ? 'guest' : 'guests'}
          </div>
        </div>
        <button
          className="btn btn-outline btn-sm"
          disabled={!!session.waiterCalledAt}
          onClick={() => {
            actions.callWaiter(session.token)
            setToast('A waiter is on the way')
          }}
        >
          <Icon name="bell" size={16} />
          {session.waiterCalledAt ? 'Waiter called' : 'Call waiter'}
        </button>
      </header>

      <nav className="c-tabs">
        <button className={tab === 'menu' ? 'active' : ''} onClick={() => setTab('menu')}>
          Menu
        </button>
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
          My orders {bill.itemCount > 0 && <span className="pill">{bill.itemCount}</span>}
        </button>
      </nav>

      <div className="c-body">
        <div className="c-main">
          {tab === 'menu' ? (
            <>
              <div className="c-menu-bar">
                <label className="c-search">
                  <Icon name="search" size={18} />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search dishes, e.g. curry, vegan, halal"
                    aria-label="Search the menu"
                    enterKeyHint="search"
                  />
                  {query && (
                    <button className="c-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                      <Icon name="x" size={16} />
                    </button>
                  )}
                </label>
                {!searching && (
                  <div className="c-categories">
                    {CATEGORIES.map((c) => (
                      <button key={c.id} className={category === c.id ? 'active' : ''} onClick={() => scrollTo(c.id)}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <main className="c-menu">
                {searching ? (
                  <section className="c-section">
                    <p className="c-results">
                      {results.length === 0
                        ? `No dishes match “${query.trim()}”.`
                        : `${results.length} ${results.length === 1 ? 'dish' : 'dishes'} found`}
                    </p>
                    <div className="menu-grid">
                      {results.map((item) => (
                        <MenuItemRow key={item.id} item={item} soldOut={soldOut.includes(item.id)} onPick={setPicking} />
                      ))}
                    </div>
                  </section>
                ) : (
                  CATEGORIES.map((c) => (
                    <section key={c.id} id={`cat-${c.id}`} className="c-section">
                      <h2>{c.name}</h2>
                      <div className="menu-grid">
                        {MENU.filter((m) => m.categoryId === c.id).map((item) => (
                          <MenuItemRow key={item.id} item={item} soldOut={soldOut.includes(item.id)} onPick={setPicking} />
                        ))}
                      </div>
                    </section>
                  ))
                )}
                <button className="credits-link" onClick={() => setCreditsOpen(true)}>
                  Photo credits
                </button>
              </main>
            </>
          ) : (
            <OrdersView orders={orders}>
              {!wide && orders.length > 0 && (
                <BillCard orders={orders} session={session} onPay={() => setPayOpen(true)} onRequestBill={requestBill} />
              )}
            </OrdersView>
          )}
        </div>

        {wide && (
          <aside className="c-aside">
            {tab === 'menu' ? (
              <section className="card cart-panel">
                <h3 className="panel-title">Your order</h3>
                {cart.length === 0 ? (
                  <p className="muted small cart-empty">Choose dishes from the menu. They will appear here before you send them to the kitchen.</p>
                ) : (
                  <div className="cart-panel-lines">
                    <CartLines lines={cart} setLines={setCart} />
                  </div>
                )}
                <button className="btn btn-primary btn-block" disabled={cart.length === 0} onClick={sendOrder}>
                  Send to kitchen{cartCount > 0 && ` · ${formatTHB(cartTotal)}`}
                </button>
              </section>
            ) : (
              <>
                {cartCount > 0 && (
                  <button className="card unsent-note" onClick={() => setTab('menu')}>
                    {cartCount} {cartCount === 1 ? 'item' : 'items'} not sent yet. <span>Back to your order</span>
                  </button>
                )}
                {orders.length > 0 && (
                  <BillCard orders={orders} session={session} onPay={() => setPayOpen(true)} onRequestBill={requestBill} />
                )}
              </>
            )}
          </aside>
        )}
      </div>

      {!wide && cartCount > 0 && (
        <div className="c-cartbar">
          <button className="btn btn-primary btn-block" onClick={() => setCartOpen(true)}>
            <span className="pill pill-light">{cartCount}</span>
            <span>View order</span>
            <span>{formatTHB(cartTotal)}</span>
          </button>
        </div>
      )}

      {picking && (
        <ItemSheet
          item={picking}
          onClose={() => setPicking(null)}
          onAdd={(line) => {
            setCart((c) => [...c, line])
            setPicking(null)
            setToast(`Added ${line.quantity} × ${line.name}`)
          }}
        />
      )}

      {cartOpen && (
        <CartSheet lines={cart} setLines={setCart} onClose={() => setCartOpen(false)} onSend={sendOrder} />
      )}

      {payOpen && (
        <PaySheet
          amount={bill.total}
          tableNumber={session.tableNumber}
          sessionToken={session.token}
          onClose={() => setPayOpen(false)}
          onPaid={() => actions.settle(session.token, 'stripe', bill.total)}
        />
      )}

      {creditsOpen && <PhotoCreditsSheet onClose={() => setCreditsOpen(false)} />}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

/** Every word typed must appear in the dish name, description, category, options or dietary labels */
function searchMenu(query: string): MenuItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  return MENU.filter((m) => {
    const category = CATEGORIES.find((c) => c.id === m.categoryId)?.name ?? ''
    const options = (m.optionGroups ?? []).flatMap((g) => g.choices.map((c) => c.name))
    const dietary = (m.dietary ?? []).map((d) => DIETARY_LABEL[d])
    const text = [m.name, m.description, category, ...options, ...dietary, ...(m.allergens ?? [])].join(' ').toLowerCase()
    return words.every((w) => text.includes(w))
  })
}

function DietaryInfo({ item }: { item: MenuItem }) {
  const tags = item.dietary ?? []
  const allergens = allergenSentence(item.allergens ?? [])
  if (tags.length === 0 && !allergens) return null
  return (
    <span className="dietary">
      {tags.map((t) => (
        <span key={t} className={`diet-tag diet-${t}`}>
          {DIETARY_LABEL[t]}
        </span>
      ))}
      {allergens && <span className="allergens">{allergens}</span>}
    </span>
  )
}

function MenuItemRow({ item, soldOut, onPick }: { item: MenuItem; soldOut: boolean; onPick: (item: MenuItem) => void }) {
  return (
    <button className={`menu-item ${soldOut ? 'sold-out' : ''}`} disabled={soldOut} onClick={() => onPick(item)}>
      <span className="menu-info">
        <span className="menu-name">
          {item.name}
          {item.recommended && <span className="tag">Popular</span>}
        </span>
        <span className="menu-desc">{item.description}</span>
        <DietaryInfo item={item} />
        {item.image && <span className="menu-price">{soldOut ? 'Sold out' : formatTHB(item.price)}</span>}
      </span>
      {item.image ? (
        <span className="menu-photo">
          <img src={item.image} alt="" loading="lazy" decoding="async" width={104} height={104} />
          {!soldOut && (
            <span className="menu-add">
              <Icon name="plus" size={16} />
            </span>
          )}
        </span>
      ) : (
        <span className="menu-side">
          <span className="menu-price">{soldOut ? 'Sold out' : formatTHB(item.price)}</span>
          {!soldOut && (
            <span className="menu-add">
              <Icon name="plus" size={16} />
            </span>
          )}
        </span>
      )}
    </button>
  )
}

function ItemSheet({ item, onClose, onAdd }: { item: MenuItem; onClose: () => void; onAdd: (l: CartLine) => void }) {
  const groups = item.optionGroups ?? []
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [picked, setPicked] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, g.type === 'single' ? [g.choices[0].id] : []])),
  )

  const options: SelectedOption[] = groups.flatMap((g) =>
    g.choices
      .filter((c) => picked[g.id]?.includes(c.id))
      .map((c) => ({ groupName: g.name, choiceName: c.name, price: c.price })),
  )
  const unitPrice = item.price + options.reduce((n, o) => n + o.price, 0)

  const toggle = (groupId: string, choiceId: string, single: boolean) =>
    setPicked((p) => {
      const cur = p[groupId] ?? []
      if (single) return { ...p, [groupId]: [choiceId] }
      return { ...p, [groupId]: cur.includes(choiceId) ? cur.filter((c) => c !== choiceId) : [...cur, choiceId] }
    })

  return (
    <Sheet
      title={item.name}
      onClose={onClose}
      footer={
        <div className="row gap">
          <div className="stepper">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Less">
              <Icon name="minus" size={16} />
            </button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} aria-label="More">
              <Icon name="plus" size={16} />
            </button>
          </div>
          <button
            className="btn btn-primary grow"
            onClick={() =>
              onAdd({ id: randomToken(6), menuItemId: item.id, name: item.name, unitPrice, quantity: qty, options, note: note.trim() })
            }
          >
            Add · {formatTHB(unitPrice * qty)}
          </button>
        </div>
      }
    >
      {item.image && <img className="item-hero" src={item.image} alt={item.name} />}
      {PHOTO_CREDITS[item.id] && (
        <a className="photo-credit" href={PHOTO_CREDITS[item.id].source} target="_blank" rel="noreferrer">
          Photo: {PHOTO_CREDITS[item.id].author} · {PHOTO_CREDITS[item.id].license}
        </a>
      )}
      <p className="muted item-desc">{item.description}</p>
      <div className="item-price">{formatTHB(item.price)}</div>
      <div className="item-dietary">
        <DietaryInfo item={item} />
        {!item.allergens?.length && <span className="muted small">No common allergens listed.</span>}
        <p className="muted small">Please tell our staff about any allergies or dietary needs before ordering.</p>
      </div>
      {groups.map((g) => (
        <fieldset key={g.id} className="option-group">
          <legend>
            {g.name} <span className="muted">{g.type === 'single' ? 'Pick 1' : 'Optional'}</span>
          </legend>
          {g.choices.map((c) => (
            <label key={c.id} className="option">
              <input
                type={g.type === 'single' ? 'radio' : 'checkbox'}
                name={g.id}
                checked={picked[g.id]?.includes(c.id) ?? false}
                onChange={() => toggle(g.id, c.id, g.type === 'single')}
              />
              <span className="grow">{c.name}</span>
              {c.price > 0 && <span className="muted">+{formatTHB(c.price)}</span>}
            </label>
          ))}
        </fieldset>
      ))}
      <label className="field">
        <span>Note for the kitchen</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. no coriander" maxLength={120} />
      </label>
    </Sheet>
  )
}

function CartLines({
  lines,
  setLines,
}: {
  lines: CartLine[]
  setLines: React.Dispatch<React.SetStateAction<CartLine[]>>
}) {
  const changeQty = (id: string, delta: number) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, quantity: l.quantity + delta } : l)).filter((l) => l.quantity > 0))

  return (
    <ul className="line-list">
      {lines.map((l) => (
        <li key={l.id} className="line">
          <div className="grow">
            <div className="line-name">{l.name}</div>
            {l.options.length > 0 && <div className="muted small">{l.options.map((o) => o.choiceName).join(', ')}</div>}
            {l.note && <div className="muted small">“{l.note}”</div>}
            <div className="small">{formatTHB(l.unitPrice * l.quantity)}</div>
          </div>
          <div className="stepper stepper-sm">
            <button onClick={() => changeQty(l.id, -1)} aria-label="Less">
              <Icon name="minus" size={14} />
            </button>
            <span>{l.quantity}</span>
            <button onClick={() => changeQty(l.id, 1)} aria-label="More">
              <Icon name="plus" size={14} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

function CartSheet({
  lines,
  setLines,
  onClose,
  onSend,
}: {
  lines: CartLine[]
  setLines: React.Dispatch<React.SetStateAction<CartLine[]>>
  onClose: () => void
  onSend: () => void
}) {
  const total = lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0)
  return (
    <Sheet
      title="Your order"
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" disabled={lines.length === 0} onClick={onSend}>
          Send to kitchen · {formatTHB(total)}
        </button>
      }
    >
      {lines.length === 0 && <p className="muted">Your cart is empty.</p>}
      <CartLines lines={lines} setLines={setLines} />
    </Sheet>
  )
}

function OrdersView({ orders, children }: { orders: Order[]; children?: React.ReactNode }) {
  const now = useNow()

  if (orders.length === 0) {
    return (
      <main className="c-orders">
        <p className="empty">Nothing ordered yet. Pick something from the menu!</p>
      </main>
    )
  }

  return (
    <main className="c-orders">
      {[...orders].reverse().map((o) => (
        <section key={o.id} className="card">
          <div className="row between">
            <strong>Round {o.round}</strong>
            <span className="muted small">
              {formatTime(o.createdAt)} · {formatElapsed(o.createdAt, now)}
            </span>
          </div>
          <ul className="line-list">
            {o.items.map((i) => (
              <li key={i.id} className={`line ${i.status === 'cancelled' ? 'struck' : ''}`}>
                <div className="grow">
                  <div className="line-name">
                    {i.quantity} × {i.name}
                  </div>
                  {i.options.length > 0 && <div className="muted small">{i.options.map((x) => x.choiceName).join(', ')}</div>}
                </div>
                <StatusBadge status={i.status} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {children}
    </main>
  )
}

function BillCard({
  orders,
  session,
  onPay,
  onRequestBill,
}: {
  orders: Order[]
  session: TableSession
  onPay: () => void
  onRequestBill: () => void
}) {
  const bill = calculateBill(orders)
  return (
    <section className="card bill">
      <h3>Bill so far</h3>
      <div className="row between">
        <span>Subtotal</span>
        <span>{formatTHB(bill.subtotal)}</span>
      </div>
      <div className="row between muted">
        <span>Service charge 10%</span>
        <span>{formatTHB(bill.serviceCharge)}</span>
      </div>
      <div className="row between muted">
        <span>VAT 7%</span>
        <span>{formatTHB(bill.vat)}</span>
      </div>
      <div className="row between total">
        <span>Total</span>
        <span>{formatTHB(bill.total)}</span>
      </div>
      <div className="row gap">
        <button className="btn btn-outline grow" disabled={!!session.billRequestedAt} onClick={onRequestBill}>
          {session.billRequestedAt ? 'Bill requested' : 'Ask for bill'}
        </button>
        <button className="btn btn-primary grow" disabled={bill.total === 0} onClick={onPay}>
          Pay now
        </button>
      </div>
    </section>
  )
}

function PhotoCreditsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Photo credits" onClose={onClose}>
      <p className="muted small">Sample photos from Wikimedia Commons, used under the licences below.</p>
      <ul className="line-list credits-list">
        {MENU.filter((m) => PHOTO_CREDITS[m.id]).map((m) => {
          const c = PHOTO_CREDITS[m.id]
          return (
            <li key={m.id} className="line">
              <div className="grow">
                <div className="line-name">{m.name}</div>
                <div className="muted small">
                  <a href={c.source} target="_blank" rel="noreferrer">
                    {c.author}
                  </a>{' '}
                  ·{' '}
                  <a href={c.licenseUrl} target="_blank" rel="noreferrer">
                    {c.license}
                  </a>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

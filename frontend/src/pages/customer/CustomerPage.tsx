import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatElapsed, formatTime, useNow } from '../../components/format'
import { Icon } from '../../components/Icon'
import { DemoBanner, Sheet, StatusBadge } from '../../components/shared'
import { useMediaQuery } from '../../components/useMediaQuery'
import { RESTAURANT_NAME } from '../../demo/mockData'
import { formatAUD, gstIncluded } from '../../demo/money'
import { allergenSentence, DIETARY_LABEL } from '../../demo/dietary'
import PaySheet from './PaySheet'
import { BookMenu, FeedMenu } from './templates'
import { useDesign } from '../../components/design'
import { useStripeRedirectReturn } from './stripe'
import { guestActions, randomToken, useGuestState, useRefreshOnFocus } from '../../demo/store'
import type { CartLine, MenuData, MenuItem, Order, SelectedOption, TableSession as Session } from '../../demo/types'
import './customer.css'

export default function CustomerPage() {
  const [params] = useSearchParams()
  const token = params.get('session') ?? ''
  if (!token) return <SessionMessage title="Scan the QR code on your table" text="Ask our staff for a QR code to start ordering." />
  return <TableSession token={token} />
}

/** Loads the table session from the server; the token in the QR code is the guest's key */
function TableSession({ token }: { token: string }) {
  const { state, missing, error } = useGuestState(token)
  useRefreshOnFocus(token)

  if (missing) {
    return <SessionMessage title="This QR code is not valid" text="Please ask our staff for your table's QR code." />
  }
  if (!state) {
    return <SessionMessage title={error ? 'Can’t reach the restaurant' : 'Loading your table…'} text={error ? 'Check your connection; we’ll keep trying.' : ''} />
  }
  if (state.session.status === 'closed') {
    return (
      <SessionMessage
        title="Thank you for dining with us!"
        text={`Table ${state.session.tableNumber}'s visit has ended. Please ask our staff if you'd like to order again.`}
      />
    )
  }
  return <OrderingApp session={state.session} orders={state.orders} soldOut={state.menu.soldOut ?? []} menu={state.menu} />
}

function SessionMessage({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="customer">
      <DemoBanner />
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
  // v2: cart options carry their ids so the server can price them
  const key = `oms-cart-v2-${token}`
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

function OrderingApp({ session, orders, soldOut, menu }: { session: Session; orders: Order[]; soldOut: string[]; menu: MenuData }) {
  const [tab, setTab] = useState<'menu' | 'orders'>('menu')
  const design = useDesign()
  // Only dishes the admin has not hidden, in categories that have some
  const items = useMemo(() => menu.items.filter((m) => !m.hidden), [menu.items])
  const categories = useMemo(
    () => menu.categories.filter((c) => items.some((m) => m.categoryId === c.id)),
    [menu.categories, items],
  )
  const [category, setCategory] = useState(categories[0]?.id ?? '')
  const [picking, setPicking] = useState<MenuItem | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searching = query.trim().length > 0
  const results = useMemo(() => searchMenu(query, items, categories), [query, items, categories])
  const [toast, setToast] = useState<string | null>(null)
  const [cart, setCart] = useCart(session.token)
  // iPad landscape and desktop: cart / visit summary stay visible in a side column
  const wide = useMediaQuery('(min-width: 1024px)')

  const activeOrders = orders.filter((o) => o.payment.status !== 'cancelled').length
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

  // Pay first: the cart goes to checkout; the order is only placed once paid (or as "pay at counter")
  const checkout = () => {
    setCartOpen(false)
    setPayOpen(true)
  }

  const placed = (order: Order) => {
    setPayOpen(false)
    setCart([])
    setTab('orders')
    setToast(
      order.payment.status === 'paid'
        ? `Paid. Order #${order.number} is on its way to the kitchen`
        : `Order #${order.number} placed. Please pay at the counter`,
    )
  }

  // Returning from a redirect-based Stripe payment method
  useStripeRedirectReturn(session.token, placed)

  const scrollTo = (id: string) => {
    setCategory(id)
    document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // The section bar follows the reader: highlight the section on screen and keep its tab in view
  const categoryBar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (design !== 'classic' || tab !== 'menu' || searching) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length) setCategory(visible[0].target.id.replace(/^cat-/, ''))
      },
      { rootMargin: '-180px 0px -55% 0px' },
    )
    categories.forEach((c) => {
      const el = document.getElementById(`cat-${c.id}`)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [design, tab, searching, categories])
  useEffect(() => {
    categoryBar.current
      ?.querySelector<HTMLElement>('button.active')
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [category])

  const callWaiter = () => {
    guestActions
      .callWaiter(session.token)
      .then(() => setToast('A waiter is on the way'))
      .catch((e: Error) => setToast(e.message))
  }

  // Shared by every template: dish sheet, cart, checkout and messages
  const overlays = (
    <>
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
      {cartOpen && <CartSheet lines={cart} setLines={setCart} onClose={() => setCartOpen(false)} onCheckout={checkout} />}
      {payOpen && <PaySheet lines={cart} sessionToken={session.token} onClose={() => setPayOpen(false)} onPlaced={placed} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  )

  // The menu book and the photo feed are whole templates of their own
  if (design !== 'classic') {
    const Template = design === 'heritage' ? BookMenu : FeedMenu
    return (
      <div className={`customer customer-${design}`}>
        <DemoBanner />
        <Template
          session={session}
          items={items}
          categories={categories}
          soldOut={soldOut}
          query={query}
          setQuery={setQuery}
          results={results}
          tab={tab}
          setTab={setTab}
          activeOrders={activeOrders}
          cartCount={cartCount}
          cartTotal={cartTotal}
          onPick={setPicking}
          onOpenCart={() => setCartOpen(true)}
          onCallWaiter={callWaiter}
          ordersView={<OrdersView orders={orders}>{orders.length > 0 && <VisitSummary orders={orders} />}</OrdersView>}
        />
        {overlays}
      </div>
    )
  }

  return (
    <div className="customer">
      <DemoBanner />
      <header className="c-header">
        <img className="c-logo" src="/brand/ying-thai-2-logo.png" alt="" width={56} height={56} />
        <div className="c-header-text">
          <div className="c-restaurant">{RESTAURANT_NAME}</div>
          <div className="c-table">
            Table {session.tableNumber} · {session.guests} {session.guests === 1 ? 'guest' : 'guests'}
          </div>
        </div>
        <button
          className="btn btn-outline btn-sm"
          disabled={!!session.waiterCalledAt}
          onClick={callWaiter}
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
          My orders {activeOrders > 0 && <span className="pill">{activeOrders}</span>}
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
                    placeholder="Search by name or number, e.g. curry, 32, gluten free"
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
                  <div className="c-categories" ref={categoryBar}>
                    {categories.map((c) => (
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
                  categories.map((c) => (
                    <section key={c.id} id={`cat-${c.id}`} className="c-section">
                      <h2>
                        <span className="c-section-name">{c.name}</span>
                        {c.nameTh && (
                          <span className="c-section-th" lang="th">
                            {c.nameTh}
                          </span>
                        )}
                      </h2>
                      <div className="menu-grid">
                        {items.filter((m) => m.categoryId === c.id).map((item) => (
                          <MenuItemRow key={item.id} item={item} soldOut={soldOut.includes(item.id)} onPick={setPicking} />
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </main>
            </>
          ) : (
            <OrdersView orders={orders}>{!wide && orders.length > 0 && <VisitSummary orders={orders} />}</OrdersView>
          )}
        </div>

        {wide && (
          <aside className="c-aside">
            {tab === 'menu' ? (
              <section className="card cart-panel">
                <h3 className="panel-title">Your order</h3>
                {cart.length === 0 ? (
                  <p className="muted small cart-empty">Choose dishes from the menu. You pay at checkout, then we bring the food to your table.</p>
                ) : (
                  <div className="cart-panel-lines">
                    <CartLines lines={cart} setLines={setCart} />
                  </div>
                )}
                <button className="btn btn-primary btn-block" disabled={cart.length === 0} onClick={checkout}>
                  Checkout{cartCount > 0 && ` · ${formatAUD(cartTotal)}`}
                </button>
              </section>
            ) : (
              <>
                {cartCount > 0 && (
                  <button className="card unsent-note" onClick={() => setTab('menu')}>
                    {cartCount} {cartCount === 1 ? 'item' : 'items'} in your cart, not ordered yet. <span>Back to checkout</span>
                  </button>
                )}
                {orders.length > 0 && <VisitSummary orders={orders} />}
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
            <span>{formatAUD(cartTotal)}</span>
          </button>
        </div>
      )}

      {overlays}
    </div>
  )
}

/** Every word typed must appear in the dish name, description, category, options or dietary labels */
function searchMenu(query: string, items: MenuItem[], categories: MenuData['categories']): MenuItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  return items.filter((m) => {
    const category = categories.find((c) => c.id === m.categoryId)?.name ?? ''
    const options = (m.optionGroups ?? []).flatMap((g) => g.choices.map((c) => c.name))
    const dietary = (m.dietary ?? []).map((d) => DIETARY_LABEL[d])
    const text = [m.name, m.nameTh, m.description, category, ...options, ...dietary, ...(m.allergens ?? [])]
      .join(' ')
      .toLowerCase()
    // A number on its own finds that dish on the printed menu
    return words.every((w) => (/^\d+$/.test(w) ? String(m.number) === w : text.includes(w)))
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
          {item.number && <span className="menu-number">{item.number}.</span>}
          <span className="menu-name-en">{item.name}</span>
          {item.nameTh && (
            <span className="menu-name-th" lang="th">
              {item.nameTh}
            </span>
          )}
          {item.recommended && <span className="tag">Popular</span>}
        </span>
        <span className="menu-desc">{item.description}</span>
        <DietaryInfo item={item} />
        {item.image && <span className="menu-price">{soldOut ? 'Sold out' : formatAUD(item.price)}</span>}
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
          <span className="menu-price">{soldOut ? 'Sold out' : formatAUD(item.price)}</span>
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
      .map((c) => ({ groupId: g.id, choiceId: c.id, groupName: g.name, choiceName: c.name, price: c.price })),
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
            Add · {formatAUD(unitPrice * qty)}
          </button>
        </div>
      }
    >
      {item.image && <img className="item-hero" src={item.image} alt={item.name} />}
      {(item.number || item.nameTh) && (
        <div className="item-names">
          {item.number && <span className="item-number">No. {item.number}</span>}
          {item.nameTh && (
            <span className="menu-name-th" lang="th">
              {item.nameTh}
            </span>
          )}
        </div>
      )}
      {item.description && <p className="muted item-desc">{item.description}</p>}
      <div className="item-price">{formatAUD(item.price)}</div>
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
              {c.price > 0 && <span className="muted">+{formatAUD(c.price)}</span>}
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
            <div className="small">{formatAUD(l.unitPrice * l.quantity)}</div>
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
  onCheckout,
}: {
  lines: CartLine[]
  setLines: React.Dispatch<React.SetStateAction<CartLine[]>>
  onClose: () => void
  onCheckout: () => void
}) {
  const total = lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0)
  return (
    <Sheet
      title="Your order"
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" disabled={lines.length === 0} onClick={onCheckout}>
          Checkout · {formatAUD(total)}
        </button>
      }
    >
      {lines.length === 0 && <p className="muted">Your cart is empty.</p>}
      <CartLines lines={lines} setLines={setLines} />
    </Sheet>
  )
}

const PAY_LABEL: Record<string, string> = { stripe: 'Paid on phone', card_terminal: 'Paid by card', cash: 'Paid in cash' }

function OrdersView({ orders, children }: { orders: Order[]; children?: React.ReactNode }) {
  const now = useNow()
  const waiting = orders.filter((o) => o.payment.status === 'awaiting_counter')

  if (orders.length === 0) {
    return (
      <main className="c-orders">
        <p className="empty">Nothing ordered yet. Pick something from the menu!</p>
      </main>
    )
  }

  return (
    <main className="c-orders">
      {waiting.map((o) => (
        <section key={o.id} className="card pay-at-counter" role="status">
          <div className="pay-at-counter-label">Pay at the counter</div>
          <div className="pay-at-counter-number">Order #{o.number}</div>
          <div className="pay-at-counter-amount">{formatAUD(o.payment.amount)}</div>
          <p className="muted small">Show this to our staff. We start cooking as soon as it&apos;s paid.</p>
        </section>
      ))}
      {[...orders].reverse().map((o) => (
        <section key={o.id} className={`card ${o.payment.status === 'cancelled' ? 'is-cancelled' : ''}`}>
          <div className="row between">
            <strong>Order #{o.number}</strong>
            <span className="muted small">
              {formatTime(o.createdAt)} · {formatElapsed(o.createdAt, now)}
            </span>
          </div>
          <div className={`order-pay order-pay-${o.payment.status}`}>
            {o.payment.status === 'paid'
              ? `${PAY_LABEL[o.payment.method ?? 'stripe']} · ${formatAUD(o.payment.amount)}`
              : o.payment.status === 'awaiting_counter'
                ? `Waiting for payment at the counter · ${formatAUD(o.payment.amount)}`
                : 'Cancelled, not paid'}
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
                {o.payment.status === 'awaiting_counter' ? <span className="muted small">Not paid yet</span> : <StatusBadge status={i.status} />}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {children}
    </main>
  )
}

/** What this table has paid so far; with pay first there is no bill at the end */
function VisitSummary({ orders }: { orders: Order[] }) {
  const paid = orders.filter((o) => o.payment.status === 'paid')
  const total = paid.reduce((n, o) => n + o.payment.amount, 0)
  const waiting = orders.filter((o) => o.payment.status === 'awaiting_counter')
  return (
    <section className="card bill">
      <h3>This visit</h3>
      <div className="row between">
        <span>Paid orders</span>
        <span>{paid.length}</span>
      </div>
      <div className="row between total">
        <span>Paid so far</span>
        <span>{formatAUD(total)}</span>
      </div>
      <div className="row between muted">
        <span>Includes GST</span>
        <span>{formatAUD(gstIncluded(total))}</span>
      </div>
      {waiting.length > 0 && (
        <p className="small visit-waiting">
          {waiting.length === 1 ? 'One order is' : `${waiting.length} orders are`} waiting for payment at the counter.
        </p>
      )}
      <p className="muted small visit-note">Everything is paid when you order, so there&apos;s no bill at the end. Want more? Order again from the menu.</p>
    </section>
  )
}

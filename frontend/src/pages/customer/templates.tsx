// Alternative guest menu templates. Each one lays the menu out differently; the cart, dish sheet,
// checkout and orders are shared with the classic list in CustomerPage.
//   BookMenu: like Ying Thai 2's printed menu, one section per page, numbered lines with dotted leaders
//   FeedMenu: like a food-delivery app, photo carousels per section and a bottom tab bar
import { useRef, useState, type ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/shared'
import { RESTAURANT_NAME } from '../../demo/mockData'
import { formatAUD } from '../../demo/money'
import type { MenuCategory, MenuItem, TableSession } from '../../demo/types'
import './templates.css'

export type TemplateProps = {
  session: TableSession
  items: MenuItem[]
  categories: MenuCategory[]
  soldOut: string[]
  query: string
  setQuery: (q: string) => void
  results: MenuItem[]
  tab: 'menu' | 'orders'
  setTab: (tab: 'menu' | 'orders') => void
  activeOrders: number
  cartCount: number
  cartTotal: number
  onPick: (item: MenuItem) => void
  onOpenCart: () => void
  onCallWaiter: () => void
  /** "My orders" with the visit summary, rendered by the page */
  ordersView: ReactNode
}

const LOGO = '/brand/ying-thai-2-logo.png'

const guestsLine = (s: TableSession) => `Table ${s.tableNumber} · ${s.guests} ${s.guests === 1 ? 'guest' : 'guests'}`

const resultsLine = (query: string, n: number) =>
  n === 0 ? `No dishes match “${query.trim()}”.` : `${n} ${n === 1 ? 'dish' : 'dishes'} found`

/** The printed menu's round marks: GF, P (peanuts), C (cashew nuts), chilli, V (vegetarian option) */
function Marks({ item }: { item: MenuItem }) {
  const d = item.dietary ?? []
  const a = item.allergens ?? []
  return (
    <span className="marks">
      {d.includes('gluten-free') && (
        <span className="mark mark-gf" title="Gluten free">
          GF
        </span>
      )}
      {a.includes('peanuts') && (
        <span className="mark mark-p" title="Contains peanuts">
          P
        </span>
      )}
      {a.includes('tree-nuts') && (
        <span className="mark mark-c" title="Contains cashew nuts">
          C
        </span>
      )}
      {d.includes('vegetarian-option') && (
        <span className="mark mark-v" title="Vegetarian option">
          V
        </span>
      )}
      {d.includes('spicy') && (
        <span className="mark mark-spicy" title="Spicy">
          <Icon name="flame" size={13} />
        </span>
      )}
    </span>
  )
}

function CartBar({ count, total, onOpen, className }: { count: number; total: number; onOpen: () => void; className: string }) {
  if (count === 0) return null
  return (
    <div className={className}>
      <button className="btn btn-primary btn-block" onClick={onOpen}>
        <span className="pill pill-light">{count}</span>
        <span>View order</span>
        <span>{formatAUD(total)}</span>
      </button>
    </div>
  )
}

/* ====================================================================
 * Menu book: one section per page, like the printed menu
 * ==================================================================== */

function BookDish({ item, soldOut, onPick }: { item: MenuItem; soldOut: boolean; onPick: (m: MenuItem) => void }) {
  return (
    <button
      className={`book-dish ${item.recommended ? 'is-featured' : ''} ${soldOut ? 'sold-out' : ''}`}
      disabled={soldOut}
      onClick={() => onPick(item)}
    >
      <span className="book-dish-line">
        {item.number && <span className="book-dish-no">{item.number}.</span>}
        <span className="book-dish-name">
          {item.name}
          {item.nameTh && (
            <span className="book-dish-th" lang="th">
              {' '}
              {item.nameTh}
            </span>
          )}
        </span>
        <Marks item={item} />
        <span className="book-leader" aria-hidden="true" />
        <span className="book-dish-price">{soldOut ? 'Sold out' : formatAUD(item.price)}</span>
      </span>
      {item.description && <span className="book-dish-desc">{item.description}</span>}
    </button>
  )
}

function BookLegend() {
  return (
    <p className="book-legend">
      <span className="mark mark-gf">GF</span> Gluten free <span className="mark mark-p">P</span> Peanuts{' '}
      <span className="mark mark-c">C</span> Cashew nuts <span className="mark mark-v">V</span> Vegetarian option{' '}
      <span className="mark mark-spicy">
        <Icon name="flame" size={13} />
      </span>{' '}
      Spicy
    </p>
  )
}

export function BookMenu(p: TemplateProps) {
  const [page, setPage] = useState(0)
  const [contentsOpen, setContentsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const top = useRef<HTMLDivElement>(null)
  const touchX = useRef<number | null>(null)

  const last = p.categories.length - 1
  const current = Math.min(page, last)
  const section = p.categories[current]
  const dishes = p.items.filter((m) => m.categoryId === section?.id)
  const photos = dishes.filter((m) => m.image).slice(0, 3)
  const prev = p.categories[current - 1]
  const next = p.categories[current + 1]

  const go = (i: number) => {
    setPage(Math.max(0, Math.min(last, i)))
    p.setTab('menu')
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const numbers = (c: MenuCategory) => {
    const n = p.items.filter((m) => m.categoryId === c.id && m.number).map((m) => m.number!)
    if (n.length === 0) return ''
    const lo = Math.min(...n)
    const hi = Math.max(...n)
    return lo === hi ? `${lo}` : `${lo}–${hi}`
  }

  return (
    <div className="book">
      <header className="book-head">
        <img className="book-logo" src={LOGO} alt="" width={64} height={64} />
        <div className="book-name">{RESTAURANT_NAME}</div>
        <div className="book-table">{guestsLine(p.session)}</div>
        <nav className="book-tools" aria-label="Menu tools">
          <button onClick={() => setContentsOpen(true)}>
            <Icon name="book" size={16} /> Contents
          </button>
          <button onClick={() => setSearchOpen(true)}>
            <Icon name="search" size={16} /> Search
          </button>
          <button className={p.tab === 'orders' ? 'active' : ''} onClick={() => p.setTab(p.tab === 'orders' ? 'menu' : 'orders')}>
            <Icon name="receipt" size={16} /> My orders {p.activeOrders > 0 && <span className="pill">{p.activeOrders}</span>}
          </button>
          <button disabled={!!p.session.waiterCalledAt} onClick={p.onCallWaiter}>
            <Icon name="bell" size={16} /> {p.session.waiterCalledAt ? 'Waiter called' : 'Call waiter'}
          </button>
        </nav>
      </header>
      <div ref={top} className="book-anchor" />

      {p.tab === 'orders' ? (
        <div className="book-orders">
          {p.ordersView}
          <button className="btn btn-outline btn-block" onClick={() => p.setTab('menu')}>
            <Icon name="chevronLeft" size={16} /> Back to the menu
          </button>
        </div>
      ) : section ? (
        <article
          className="book-page"
          key={section.id}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return
            const dx = e.changedTouches[0].clientX - touchX.current
            touchX.current = null
            if (Math.abs(dx) > 70) go(current + (dx < 0 ? 1 : -1))
          }}
        >
          <div className="book-page-head">
            <span className="book-page-no">
              Page {current + 1} of {p.categories.length}
            </span>
            <h2>{section.name}</h2>
            {section.nameTh && (
              <div className="book-page-th" lang="th">
                {section.nameTh}
              </div>
            )}
          </div>

          {photos.length > 0 && (
            <div className={`book-photos book-photos-${photos.length}`}>
              {photos.map((m) => (
                <button key={m.id} className="book-photo" onClick={() => p.onPick(m)} aria-label={m.name}>
                  <img src={m.image} alt="" loading="lazy" />
                  {m.number && <span className="book-photo-no">{m.number}</span>}
                </button>
              ))}
            </div>
          )}

          <ol className="book-list">
            {dishes.map((m) => (
              <li key={m.id}>
                <BookDish item={m} soldOut={p.soldOut.includes(m.id)} onPick={p.onPick} />
              </li>
            ))}
          </ol>

          <BookLegend />

          <footer className="book-turn">
            <button disabled={!prev} onClick={() => go(current - 1)} aria-label="Previous page">
              <Icon name="chevronLeft" size={18} />
              <span>{prev?.name ?? ''}</span>
            </button>
            <span className="book-dots" aria-hidden="true">
              {p.categories.map((c, i) => (
                <span key={c.id} className={i === current ? 'on' : ''} />
              ))}
            </span>
            <button disabled={!next} onClick={() => go(current + 1)} aria-label="Next page">
              <span>{next?.name ?? ''}</span>
              <Icon name="chevronRight" size={18} />
            </button>
          </footer>
        </article>
      ) : null}

      {contentsOpen && (
        <Sheet title="Contents" onClose={() => setContentsOpen(false)}>
          <ol className="book-contents">
            {p.categories.map((c, i) => (
              <li key={c.id}>
                <button
                  className={i === current ? 'active' : ''}
                  onClick={() => {
                    setContentsOpen(false)
                    go(i)
                  }}
                >
                  <span className="book-contents-name">
                    {c.name}
                    {c.nameTh && (
                      <span className="book-contents-th" lang="th">
                        {c.nameTh}
                      </span>
                    )}
                  </span>
                  <span className="book-contents-range">{numbers(c)}</span>
                </button>
              </li>
            ))}
          </ol>
        </Sheet>
      )}

      {searchOpen && (
        <Sheet title="Search" onClose={() => setSearchOpen(false)}>
          <label className="c-search book-search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={p.query}
              onChange={(e) => p.setQuery(e.target.value)}
              placeholder="Name or number, e.g. curry, 32, gluten free"
              aria-label="Search the menu"
              autoFocus
            />
          </label>
          {p.query.trim() && <p className="c-results">{resultsLine(p.query, p.results.length)}</p>}
          <ol className="book-list">
            {p.results.map((m) => (
              <li key={m.id}>
                <BookDish
                  item={m}
                  soldOut={p.soldOut.includes(m.id)}
                  onPick={(dish) => {
                    setSearchOpen(false)
                    p.onPick(dish)
                  }}
                />
              </li>
            ))}
          </ol>
        </Sheet>
      )}

      <CartBar className="book-cartbar" count={p.cartCount} total={p.cartTotal} onOpen={p.onOpenCart} />
    </div>
  )
}

/* ====================================================================
 * Photo feed: carousels of photo cards and a bottom tab bar
 * ==================================================================== */

function FeedCard({ item, soldOut, big, onPick }: { item: MenuItem; soldOut: boolean; big?: boolean; onPick: (m: MenuItem) => void }) {
  return (
    <button
      className={`feed-card ${big ? 'feed-card-big' : ''} ${item.image ? '' : 'feed-card-text'} ${soldOut ? 'sold-out' : ''}`}
      disabled={soldOut}
      onClick={() => onPick(item)}
    >
      {item.image ? (
        <img className="feed-card-img" src={item.image} alt="" loading="lazy" />
      ) : (
        <span className="feed-card-mono" aria-hidden="true">
          {item.nameTh || item.name}
        </span>
      )}
      <span className="feed-card-body">
        {item.number && <span className="feed-card-no">No. {item.number}</span>}
        <span className="feed-card-name">{item.name}</span>
        {big && item.description && <span className="feed-card-desc">{item.description}</span>}
        <span className="feed-card-foot">
          <span className="feed-card-price">{soldOut ? 'Sold out' : formatAUD(item.price)}</span>
          {!soldOut && (
            <span className="feed-card-add">
              <Icon name="plus" size={16} />
            </span>
          )}
        </span>
      </span>
    </button>
  )
}

export function FeedMenu(p: TemplateProps) {
  const [view, setView] = useState<'home' | 'search'>('home')
  const popular = p.items.filter((m) => m.recommended)
  const onMenu = p.tab === 'menu'

  return (
    <div className="feed">
      {!onMenu ? (
        <div className="feed-page">
          <h1 className="feed-title">My orders</h1>
          {p.ordersView}
        </div>
      ) : view === 'search' ? (
        <div className="feed-page">
          <label className="feed-search-box">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={p.query}
              onChange={(e) => p.setQuery(e.target.value)}
              placeholder="Name or number, e.g. curry, 32, gluten free"
              aria-label="Search the menu"
              autoFocus
            />
          </label>
          {p.query.trim() ? (
            <>
              <p className="c-results">{resultsLine(p.query, p.results.length)}</p>
              <div className="feed-grid">
                {p.results.map((m) => (
                  <FeedCard key={m.id} item={m} soldOut={p.soldOut.includes(m.id)} onPick={p.onPick} />
                ))}
              </div>
            </>
          ) : (
            <div className="feed-sections">
              {p.categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setView('home')
                    requestAnimationFrame(() => document.getElementById(`feed-${c.id}`)?.scrollIntoView({ behavior: 'smooth' }))
                  }}
                >
                  <span>{c.name}</span>
                  {c.nameTh && <span lang="th">{c.nameTh}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <header className="feed-hero">
            <img className="feed-logo" src={LOGO} alt="" width={72} height={72} />
            <div className="feed-name">{RESTAURANT_NAME}</div>
            <div className="feed-table">{guestsLine(p.session)}</div>
          </header>
          {popular.length > 0 && (
            <section className="feed-row">
              <div className="feed-row-head">
                <h2>Popular</h2>
                <span className="feed-row-sub">The restaurant&apos;s picks</span>
              </div>
              <div className="feed-scroller feed-scroller-big">
                {popular.map((m) => (
                  <FeedCard key={m.id} item={m} big soldOut={p.soldOut.includes(m.id)} onPick={p.onPick} />
                ))}
              </div>
            </section>
          )}
          {p.categories.map((c) => (
            <section key={c.id} id={`feed-${c.id}`} className="feed-row">
              <div className="feed-row-head">
                <h2>{c.name}</h2>
                {c.nameTh && (
                  <span className="feed-row-sub" lang="th">
                    {c.nameTh}
                  </span>
                )}
              </div>
              <div className="feed-scroller">
                {p.items
                  .filter((m) => m.categoryId === c.id)
                  .map((m) => (
                    <FeedCard key={m.id} item={m} soldOut={p.soldOut.includes(m.id)} onPick={p.onPick} />
                  ))}
              </div>
            </section>
          ))}
        </>
      )}

      {onMenu && <CartBar className="feed-cart" count={p.cartCount} total={p.cartTotal} onOpen={p.onOpenCart} />}

      <nav className="feed-tabs" aria-label="Sections">
        <button
          className={onMenu && view === 'home' ? 'active' : ''}
          onClick={() => {
            p.setTab('menu')
            setView('home')
          }}
        >
          <Icon name="home" size={20} />
          <span>Menu</span>
        </button>
        <button
          className={onMenu && view === 'search' ? 'active' : ''}
          onClick={() => {
            p.setTab('menu')
            setView('search')
          }}
        >
          <Icon name="search" size={20} />
          <span>Search</span>
        </button>
        <button className={!onMenu ? 'active' : ''} onClick={() => p.setTab('orders')}>
          <Icon name="receipt" size={20} />
          <span>My orders</span>
          {p.activeOrders > 0 && <span className="feed-tab-badge">{p.activeOrders}</span>}
        </button>
        <button disabled={!!p.session.waiterCalledAt} onClick={p.onCallWaiter}>
          <Icon name="bell" size={20} />
          <span>{p.session.waiterCalledAt ? 'Called' : 'Waiter'}</span>
        </button>
      </nav>
    </div>
  )
}

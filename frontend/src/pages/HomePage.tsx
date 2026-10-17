import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { DemoBanner } from '../components/shared'
import { RESTAURANT_NAME, RESTAURANT_TAGLINE } from '../demo/mockData'
import { actions, useHasStaffKey, useStaffState } from '../demo/store'
import './home.css'

const STEPS = [
  { title: 'Guests sit down', text: 'Staff tap a free table, enter the number of guests and open a session. A QR code with the table number and session is generated.' },
  { title: 'Order & pay', text: 'Guests scan the QR, pick dishes, options and notes, and pay at checkout: on their phone (Stripe) or at the counter. Only paid orders go to the kitchen.' },
  { title: 'Food to the table', text: 'Staff see each paid order by table and bring the food over, marking it served. Guests follow the status on their phone and can order and pay again any time.' },
  { title: 'Guests leave', text: 'Nothing to settle at the end. Staff clear the table, its QR stops working and the table is free for the next guests.' },
]

export default function HomePage() {
  const hasKey = useHasStaffKey()

  return (
    <div className="home">
      <DemoBanner />
      <header className="home-hero">
        <div className="home-eyebrow">{RESTAURANT_TAGLINE}</div>
        <h1>{RESTAURANT_NAME}</h1>
        <p>QR table ordering: a demo of the OMS restaurant flow.</p>
      </header>

      <div className="home-screens">
        <Link to="/staff" className="screen-card">
          <span className="screen-icon">
            <Icon name="grid" size={20} />
          </span>
          <strong>Front of house</strong>
          <span>Seat guests and print table QR codes, take counter payments, serve food, clear tables</span>
        </Link>
        <Link to="/admin" className="screen-card">
          <span className="screen-icon">
            <Icon name="list" size={20} />
          </span>
          <strong>Menu admin</strong>
          <span>Add and edit dishes, prices, photos and dietary info; mark dishes sold out</span>
        </Link>
        <div className="screen-card screen-card-static">
          <span className="screen-icon">
            <Icon name="phone" size={20} />
          </span>
          <strong>Customer menu</strong>
          <span>Opened by scanning a table QR.</span>
          {hasKey ? <OpenTableLinks /> : <span className="muted small">Seat guests in Front of house to get a QR code.</span>}
        </div>
      </div>

      <section className="home-flow">
        <h2>Try the flow</h2>
        <ol>
          {STEPS.map((s) => (
            <li key={s.title}>
              <strong>{s.title}</strong>
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
        <p className="muted small">
          The demo starts with sample data: tables 2, 3, 5, 6 and 7 are seated with orders at different stages. Tip: open Front of
          house on a tablet or laptop and scan a table QR with your phone. Both update live from the server. Payments use Stripe
          test mode, so no real money moves.
        </p>
        {hasKey && (
          <div className="row gap wrap">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                if (confirm('Replace everything with the sample tables and orders?')) actions.reset()
              }}
            >
              Reset to sample data
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (confirm('Clear all tables, orders and payments?')) actions.clear()
              }}
            >
              Start empty
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

/** Links to the guest menu of every seated table (staff devices only) */
function OpenTableLinks() {
  const demo = useStaffState()
  const open = Object.values(demo?.sessions ?? {}).filter((s) => s.status === 'open')
  if (!demo) return <span className="muted small">Loading tables…</span>
  if (open.length === 0) return <span className="muted small">Open a table in Front of house first.</span>
  return (
    <span className="open-links">
      {open.map((s) => (
        <Link key={s.token} to={`/order?table=${s.tableNumber}&session=${encodeURIComponent(s.token)}`}>
          Table {s.tableNumber}
        </Link>
      ))}
    </span>
  )
}

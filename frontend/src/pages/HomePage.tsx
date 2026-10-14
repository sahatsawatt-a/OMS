import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { DemoBanner } from '../components/shared'
import { RESTAURANT_NAME, RESTAURANT_TAGLINE } from '../demo/mockData'
import { actions, useDemoState } from '../demo/store'
import './home.css'

const STEPS = [
  { title: 'Guests sit down', text: 'Staff tap a free table, enter the number of guests and open a session. A QR code with the table number and session is generated.' },
  { title: 'Scan & order', text: 'Guests scan the QR and the menu opens on their phone. They pick dishes, options and notes, then send the order to the kitchen. They can order more rounds later.' },
  { title: 'Kitchen cooks', text: 'Orders appear on the kitchen display by table. Cooks mark items cooking and ready; guests see the status live.' },
  { title: 'Serve & pay', text: 'Staff serve ready items. Guests call a waiter or ask for the bill from their phone, then pay by phone (Stripe) or at the table. The session closes and the table is free again.' },
]

export default function HomePage() {
  const demo = useDemoState()
  const open = Object.values(demo.sessions).filter((s) => s.status === 'open')

  return (
    <div className="home">
      <DemoBanner />
      <header className="home-hero">
        <div className="home-eyebrow">{RESTAURANT_TAGLINE}</div>
        <h1>{RESTAURANT_NAME}</h1>
        <p>QR table ordering: a frontend demo of the OMS restaurant flow.</p>
      </header>

      <div className="home-screens">
        <Link to="/staff" className="screen-card">
          <span className="screen-icon">
            <Icon name="grid" size={20} />
          </span>
          <strong>Front of house</strong>
          <span>Seat guests, generate table QR codes, serve and settle bills</span>
        </Link>
        <div className="screen-card screen-card-static">
          <span className="screen-icon">
            <Icon name="phone" size={20} />
          </span>
          <strong>Customer menu</strong>
          <span>Opened by scanning a table QR.</span>
          {open.length > 0 ? (
            <span className="open-links">
              {open.map((s) => (
                <Link key={s.token} to={`/order?table=${s.tableNumber}&session=${encodeURIComponent(s.token)}`}>
                  Table {s.tableNumber}
                </Link>
              ))}
            </span>
          ) : (
            <span className="muted small">Open a table in Front of house first.</span>
          )}
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
          The demo starts with sample data: tables 2, 3, 5, 6 and 7 are seated with orders at different stages.
          Tip: open Front of house and a Customer menu in separate tabs side by side. They update live,
          because the demo keeps its data in this browser.
        </p>
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
      </section>
    </div>
  )
}

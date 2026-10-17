import { useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useNow } from '../../components/format'
import { useMediaQuery } from '../../components/useMediaQuery'
import { historyForToday } from '../../demo/history'
import { formatAUD } from '../../demo/money'
import type { DemoState } from '../../demo/types'
import {
  busyReport,
  change,
  combine,
  compareRange,
  financialYears,
  gstReport,
  HOURS,
  niceStep,
  PRESETS,
  rangeFor,
  salesReport,
  startOfDay,
  STRIPE_FEE_FIXED,
  STRIPE_FEE_RATE,
  WEEKDAYS,
  type Bucket,
  type BusyReport,
  type CompareMode,
  type Data,
  type DishRow,
  type GstRow,
  type HeatCell,
  type Preset,
  type SalesReport,
} from './reports'
import './reports.css'

type Section = 'sales' | 'busy' | 'gst'

const compactAUD = (cents: number) => {
  const dollars = cents / 100
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(dollars >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`
  return `$${Math.round(dollars)}`
}
const pct = (x: number) => `${Math.round(x * 100)}%`
const isoDay = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString('en-AU', { hour: 'numeric' })

/** Every n-th label, plus the latest one when it is far enough from the previous label */
const showLabel = (i: number, count: number, every: number) =>
  i % every === 0 || (i === count - 1 && (count - 1) % every >= every / 2)

function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function ReportsView({ state }: { state: DemoState }) {
  const now = useNow(60000)
  const narrow = useMediaQuery('(max-width: 760px)')
  const [section, setSection] = useState<Section>('sales')
  const [preset, setPreset] = useState<Preset>('today')
  const [custom, setCustom] = useState(() => ({ from: isoDay(startOfDay(now, -6)), to: isoDay(now) }))
  const [compareMode, setCompareMode] = useState<CompareMode>('previous')

  // Generated once per day and cached, so reopening Reports is instant
  const history = historyForToday(now, state.menu.items, state.tables)
  const data = useMemo(() => combine(state, history), [state, history])

  const range = rangeFor(preset, now, custom)
  const lastWeekAllowed = range.days <= 7
  const compare = compareRange(range, lastWeekAllowed ? compareMode : 'previous')

  const openSection = (s: Section) => {
    // A weekly pattern needs more than a day of data
    if (s === 'busy' && range.days < 7) setPreset('30d')
    setSection(s)
  }

  return (
    <div className="reports">
      <div className="report-sections" role="tablist" aria-label="Report">
        {(
          [
            ['sales', 'Sales'],
            ['busy', 'Busiest times'],
            ['gst', 'GST / BAS'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={section === id} className={section === id ? 'active' : ''} onClick={() => openSection(id)}>
            {label}
          </button>
        ))}
      </div>

      {section !== 'gst' && (
        <div className="reports-filters" role="toolbar" aria-label="Report period">
          <div className="segmented presets">
            {PRESETS.map((p) => (
              <button key={p.id} className={preset === p.id ? 'active' : ''} aria-pressed={preset === p.id} onClick={() => setPreset(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="custom-range">
              <label>
                <span>From</span>
                <input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              </label>
              <label>
                <span>To</span>
                <input type="date" value={custom.to} min={custom.from} max={isoDay(now)} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
              </label>
            </div>
          )}
          {section === 'sales' && (
            <label className="compare-select">
              <span>Compare with</span>
              <select value={lastWeekAllowed ? compareMode : 'previous'} onChange={(e) => setCompareMode(e.target.value as CompareMode)}>
                <option value="previous">Previous period</option>
                <option value="lastWeek" disabled={!lastWeekAllowed}>
                  Same days last week
                </option>
              </select>
            </label>
          )}
        </div>
      )}

      {section === 'sales' && <SalesView report={salesReport(data, range, compare)} rangeLabel={range.label} compareLabel={compare.label} narrow={narrow} now={now} />}
      {section === 'busy' && <BusyView report={busyReport(data, range)} rangeLabel={range.label} narrow={narrow} />}
      {section === 'gst' && <GstView data={data} now={now} />}

      <p className="muted small reports-note">
        Includes generated sample history for the past year plus today&apos;s demo tables, so the reports have something to show.
        Live figures will come from the restaurant&apos;s own orders once the backend is in place.
      </p>
    </div>
  )
}

// ---------- Sales ----------

function SalesView({
  report,
  rangeLabel,
  compareLabel,
  narrow,
  now,
}: {
  report: SalesReport
  rangeLabel: string
  compareLabel: string
  narrow: boolean
  now: number
}) {
  const unitTitle = report.bucketUnit === 'hour' ? 'Revenue by hour' : report.bucketUnit === 'day' ? 'Revenue by day' : 'Revenue by month'
  const every = report.bucketUnit === 'hour' ? (narrow ? 3 : 1) : report.bucketUnit === 'day' && report.buckets.length > 14 ? (narrow ? 7 : 5) : 1
  return (
    <>
      <div className="kpis">
        <StatTile label="Revenue" value={formatAUD(report.revenue)} delta={change(report.revenue, report.prev.revenue)} compare={compareLabel} sub={`Includes GST ${formatAUD(report.gst)}`} />
        <StatTile label="Paid orders" value={report.orders.toLocaleString('en-AU')} delta={change(report.orders, report.prev.orders)} compare={compareLabel} sub={`${report.itemsSold.toLocaleString('en-AU')} items sold`} />
        <StatTile label="Average order" value={formatAUD(report.avgOrder)} delta={change(report.avgOrder, report.prev.avgOrder)} compare={compareLabel} />
        <StatTile
          label="Waiting at counter"
          value={formatAUD(report.waiting.amount)}
          sub={report.waiting.orders ? `${report.waiting.orders} ${report.waiting.orders === 1 ? 'order' : 'orders'} not paid yet, right now` : 'No orders waiting right now'}
        />
      </div>

      <ChartCard
        title={unitTitle}
        subtitle={`${rangeLabel} · counted when an order is paid`}
        action={
          <button className="btn btn-sm btn-outline" onClick={() => download(`ying-thai-2-sales-${isoDay(now)}.csv`, report.csv)} disabled={report.itemsSold === 0}>
            Download CSV
          </button>
        }
        table={<DataTable head={['Period', 'Orders', 'Revenue']} rows={report.buckets.map((b) => [b.longLabel, b.orders, formatAUD(b.revenue)])} />}
      >
        <ColumnChart buckets={report.buckets} labelEvery={every} />
      </ChartCard>

      <div className="reports-grid">
        <ChartCard
          title="Top dishes"
          subtitle="By revenue"
          table={<DataTable head={['Dish', 'Category', 'Sold', 'Revenue']} rows={report.dishes.map((d) => [d.name, d.category, d.qty, formatAUD(d.revenue)])} />}
        >
          <DishBars dishes={report.dishes.slice(0, 8)} />
        </ChartCard>

        <div className="reports-col">
          <ChartCard
            title="Payment methods"
            subtitle="Share of revenue"
            table={<DataTable head={['Method', 'Orders', 'Revenue', 'Share']} rows={report.payments.map((p) => [p.label, p.count, formatAUD(p.amount), pct(p.share)])} />}
          >
            <PaymentShare payments={report.payments} />
          </ChartCard>

          <section className="card report-card">
            <header className="report-card-head">
              <div>
                <h2>Sales by category</h2>
                <p className="muted small">Items in paid orders</p>
              </div>
            </header>
            <DataTable head={['Category', 'Items', 'Revenue', 'Share']} rows={report.categories.map((c) => [c.name, c.qty, formatAUD(c.revenue), pct(c.share)])} empty="No sales in this period yet." />
          </section>

          <section className="card report-card cancelled-card">
            <div className="row between">
              <div>
                <h2>Cancelled orders</h2>
                <p className="muted small">Placed for counter payment but never paid, so nothing was made</p>
              </div>
              <div className="cancelled-figures">
                <strong>{report.cancelled.orders}</strong>
                <span className="muted small">{formatAUD(report.cancelled.amount)}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

// ---------- Busiest times ----------

// Sequential single-hue ramp (blue 100 → 700 from the validated reference palette)
const RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b']

function BusyView({ report, rangeLabel, narrow }: { report: BusyReport; rangeLabel: string; narrow: boolean }) {
  const [metric, setMetric] = useState<'orders' | 'revenue'>('orders')
  const [hover, setHover] = useState<HeatCell | null>(null)
  const max = metric === 'orders' ? report.max.avgOrders : report.max.avgRevenue
  const valueOf = (c: HeatCell) => (metric === 'orders' ? c.avgOrders : c.avgRevenue)
  const step = (c: HeatCell) => (max > 0 && valueOf(c) > 0 ? Math.min(RAMP.length - 1, Math.floor((valueOf(c) / max) * RAMP.length)) : -1)
  const describe = (c: HeatCell) =>
    `${WEEKDAYS[c.day]} ${hourLabel(c.hour)}–${hourLabel(c.hour + 1)}: about ${c.avgOrders.toFixed(1)} orders and ${formatAUD(Math.round(c.avgRevenue))} on an average ${WEEKDAYS[c.day]}`
  const focus = hover ?? report.peak

  return (
    <>
      {report.peak && report.peak.orders > 0 ? (
        <section className="card busy-headline">
          <div className="stat-label">Busiest hour · {rangeLabel}</div>
          <div className="busy-peak">
            {WEEKDAYS[report.peak.day]} {hourLabel(report.peak.hour)} – {hourLabel(report.peak.hour + 1)}
          </div>
          <div className="muted small">
            About {report.peak.avgOrders.toFixed(1)} orders and {formatAUD(Math.round(report.peak.avgRevenue))} in that hour on an average {WEEKDAYS[report.peak.day]}
          </div>
        </section>
      ) : null}

      <ChartCard
        title="Orders through the week"
        subtitle={`Average per weekday and hour · ${rangeLabel}`}
        action={
          <div className="segmented small-seg">
            <button className={metric === 'orders' ? 'active' : ''} aria-pressed={metric === 'orders'} onClick={() => setMetric('orders')}>
              Orders
            </button>
            <button className={metric === 'revenue' ? 'active' : ''} aria-pressed={metric === 'revenue'} onClick={() => setMetric('revenue')}>
              Revenue
            </button>
          </div>
        }
        table={
          <DataTable
            head={['Day', ...HOURS.map(hourLabel)]}
            rows={WEEKDAYS.map((d, di) => [
              d,
              ...HOURS.map((h) => {
                const c = report.cells[di * HOURS.length + (h - HOURS[0])]
                return metric === 'orders' ? c.avgOrders.toFixed(1) : compactAUD(Math.round(c.avgRevenue))
              }),
            ])}
          />
        }
      >
        {max === 0 ? (
          <p className="muted small chart-empty">No paid orders in this period yet.</p>
        ) : (
          <div className="heatmap" onMouseLeave={() => setHover(null)}>
            <div className="heat-grid" style={{ gridTemplateColumns: `36px repeat(${HOURS.length}, minmax(0, 1fr))` }}>
              <span />
              {HOURS.map((h, i) => (
                <span key={h} className="heat-hour">
                  {i % (narrow ? 3 : 2) === 0 ? hourLabel(h).replace(' ', '') : ''}
                </span>
              ))}
              {WEEKDAYS.map((d, di) => (
                <HeatRow key={d} day={d} cells={report.cells.slice(di * HOURS.length, (di + 1) * HOURS.length)} step={step} describe={describe} onHover={setHover} active={hover} />
              ))}
            </div>
            <p className="heat-readout" aria-live="polite">
              {focus ? describe(focus) : ''}
            </p>
            <div className="heat-legend" aria-hidden="true">
              <span className="muted small">Quieter</span>
              <span className="heat-legend-ramp">
                <span className="heat-swatch heat-zero" />
                {RAMP.map((c) => (
                  <span key={c} className="heat-swatch" style={{ background: c }} />
                ))}
              </span>
              <span className="muted small">Busier</span>
              <span className="muted small heat-legend-max">
                darkest ≈ {metric === 'orders' ? `${max.toFixed(1)} orders` : formatAUD(Math.round(max))} an hour
              </span>
            </div>
          </div>
        )}
      </ChartCard>

      <div className="kpis two">
        {report.services.map((s) => (
          <section key={s.name} className="card stat">
            <div className="stat-label">
              {s.name} · {s.name === 'Lunch' ? 'before 4 pm' : 'from 4 pm'}
            </div>
            <div className="stat-value">{formatAUD(s.revenue)}</div>
            <div className="stat-sub muted small">
              {s.orders.toLocaleString('en-AU')} orders · average {formatAUD(s.avgOrder)} · {pct(s.share)} of revenue
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

function HeatRow({
  day,
  cells,
  step,
  describe,
  onHover,
  active,
}: {
  day: string
  cells: HeatCell[]
  step: (c: HeatCell) => number
  describe: (c: HeatCell) => string
  onHover: (c: HeatCell | null) => void
  active: HeatCell | null
}) {
  return (
    <>
      <span className="heat-day">{day}</span>
      {cells.map((c) => {
        const s = step(c)
        return (
          <button
            key={c.hour}
            className={`heat-cell ${s < 0 ? 'heat-zero' : ''} ${active === c ? 'active' : ''}`}
            style={s >= 0 ? { background: RAMP[s] } : undefined}
            aria-label={describe(c)}
            onMouseEnter={() => onHover(c)}
            onFocus={() => onHover(c)}
            onBlur={() => onHover(null)}
          />
        )
      })}
    </>
  )
}

// ---------- GST / BAS ----------

function GstView({ data, now }: { data: Data; now: number }) {
  const years = financialYears(now)
  const [startYear, setStartYear] = useState(years[0].startYear)
  const report = useMemo(() => gstReport(data, startYear, now), [data, startYear, now])
  const head = ['Period', 'Total sales (G1)', 'GST on sales (1A)', 'Sales excl. GST', 'Est. Stripe fees']
  const row = (r: GstRow) => [`${r.label}${r.partial ? ' *' : ''}`, formatAUD(r.sales), formatAUD(r.gst), formatAUD(r.exGst), formatAUD(r.stripeFees)]

  return (
    <>
      <div className="reports-filters">
        <div className="segmented">
          {years.map((y) => (
            <button key={y.startYear} className={startYear === y.startYear ? 'active' : ''} aria-pressed={startYear === y.startYear} onClick={() => setStartYear(y.startYear)}>
              {y.label}
            </button>
          ))}
        </div>
        <button className="btn btn-sm btn-outline" onClick={() => download(`ying-thai-2-gst-fy${startYear}-${String(startYear + 1).slice(2)}.csv`, report.csv)}>
          Download CSV for accountant
        </button>
      </div>

      <div className="kpis">
        <StatTile label={`Total sales ${report.year.label}`} value={formatAUD(report.year.sales)} sub="Including GST (BAS label G1)" />
        <StatTile label="GST on sales" value={formatAUD(report.year.gst)} sub="1/11 of GST-inclusive sales (BAS label 1A)" />
        <StatTile label="Sales excluding GST" value={formatAUD(report.year.exGst)} sub={`${report.year.orders.toLocaleString('en-AU')} paid orders`} />
        <StatTile label="Est. Stripe fees" value={formatAUD(report.year.stripeFees)} sub={`Net from phone payments ${formatAUD(report.year.stripeNet)}`} />
      </div>

      <section className="card report-card">
        <header className="report-card-head">
          <div>
            <h2>By quarter</h2>
            <p className="muted small">Australian financial year, for the quarterly BAS</p>
          </div>
        </header>
        <DataTable head={head} rows={[...report.quarters.map(row), row(report.year)]} totalRow />
      </section>

      <section className="card report-card">
        <header className="report-card-head">
          <div>
            <h2>By month</h2>
          </div>
        </header>
        <DataTable head={head} rows={report.months.map(row)} />
      </section>

      <p className="muted small reports-note">
        * Partial period{report.firstData ? ` (sample data starts ${new Date(report.firstData).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}, or the period is not over yet)` : ''}.
        GST is worked out as 1/11 of GST-inclusive sales, assuming every menu item is taxable. Stripe fees are an estimate at{' '}
        {(STRIPE_FEE_RATE * 100).toFixed(2)}% + {STRIPE_FEE_FIXED}c per phone payment (Stripe Australia&apos;s standard domestic card rate);
        check real fees in the Stripe dashboard. Counter card terminal fees are not included. Confirm figures with your accountant before lodging a BAS.
      </p>
    </>
  )
}

// ---------- Building blocks ----------

function StatTile({ label, value, delta, compare, sub }: { label: string; value: string; delta?: number | null; compare?: string; sub?: string }) {
  return (
    <section className="card stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {delta !== undefined && (
        <div className={`stat-delta ${delta === null ? '' : delta >= 0 ? 'up' : 'down'}`}>
          {delta === null ? (
            <span className="muted">No earlier data</span>
          ) : (
            <>
              <Icon name={delta >= 0 ? 'chevronUp' : 'chevronDown'} size={14} />
              {pct(Math.abs(delta))} <span className="muted">{compare}</span>
            </>
          )}
        </div>
      )}
      {sub && <div className="stat-sub muted small">{sub}</div>}
    </section>
  )
}

function ChartCard({
  title,
  subtitle,
  table,
  action,
  children,
}: {
  title: string
  subtitle?: string
  table: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const [asTable, setAsTable] = useState(false)
  return (
    <section className="card report-card">
      <header className="report-card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        <div className="row gap wrap card-actions">
          {action}
          <button className="btn btn-sm btn-ghost" aria-pressed={asTable} onClick={() => setAsTable((t) => !t)}>
            {asTable ? 'Show chart' : 'Show table'}
          </button>
        </div>
      </header>
      {asTable ? table : children}
    </section>
  )
}

function DataTable({ head, rows, empty = 'No data for this period.', totalRow = false }: { head: string[]; rows: (string | number)[][]; empty?: string; totalRow?: boolean }) {
  if (rows.length === 0) return <p className="muted small chart-empty">{empty}</p>
  const numeric = (c: string | number) => typeof c === 'number' || /^[$\d-]/.test(String(c))
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={i > 0 ? 'num' : ''}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className={totalRow && ri === rows.length - 1 ? 'total-row' : ''}>
              {r.map((c, ci) => (
                <td key={ci} className={ci > 0 && numeric(c) ? 'num' : ''}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Single-series column chart with a hairline grid, peak label and per-column tooltip */
function ColumnChart({ buckets, labelEvery }: { buckets: Bucket[]; labelEvery: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(0, ...buckets.map((b) => b.revenue))
  const step = niceStep(max)
  const top = step * 4
  const ticks = [0, 1, 2, 3, 4].map((n) => n * step)
  const peak = buckets.findIndex((b) => b.revenue === max && max > 0)

  if (max === 0) return <p className="muted small chart-empty">No paid orders in this period yet.</p>

  return (
    <div className="colchart" onMouseLeave={() => setHover(null)}>
      <div className="colchart-plot">
        <div className="colchart-grid" aria-hidden="true">
          {ticks.map((t) => (
            <div key={t} className="gridline" style={{ bottom: `${(t / top) * 100}%` }}>
              <span>{compactAUD(t)}</span>
            </div>
          ))}
        </div>
        <div className="colchart-cols">
          {buckets.map((b, i) => {
            const h = (b.revenue / top) * 100
            return (
              <button
                key={b.key}
                className={`col ${hover === i ? 'hover' : ''}`}
                aria-label={`${b.longLabel}: ${formatAUD(b.revenue)} from ${b.orders} orders`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              >
                <span className="bar" style={{ height: `${h}%` }}>
                  {i === peak && hover === null && <span className="peak">{compactAUD(b.revenue)}</span>}
                </span>
                {hover === i && (
                  <span className={`tip ${i > buckets.length * 0.7 ? 'left' : ''}`} style={{ bottom: `calc(${h}% + 8px)` }} role="status">
                    <strong>{formatAUD(b.revenue)}</strong>
                    <span>{b.longLabel}</span>
                    <span>
                      {b.orders} {b.orders === 1 ? 'order' : 'orders'}
                    </span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      <div className="colchart-x" aria-hidden="true">
        {buckets.map((b, i) => (
          <span key={b.key}>{showLabel(i, buckets.length, labelEvery) ? b.label : ''}</span>
        ))}
      </div>
    </div>
  )
}

function DishBars({ dishes }: { dishes: DishRow[] }) {
  if (dishes.length === 0) return <p className="muted small chart-empty">No dishes sold in this period yet.</p>
  const top = Math.max(...dishes.map((d) => d.revenue))
  return (
    <ol className="dishbars">
      {dishes.map((d) => (
        <li key={d.id}>
          <span className="dish-name" title={`${d.name}: ${formatAUD(d.revenue)}, ${d.qty} sold`}>
            {d.name}
          </span>
          <span className="dish-track">
            <span className="dish-bar" style={{ width: `${Math.max(2, (d.revenue / top) * 100)}%` }} />
          </span>
          <span className="dish-value">
            {formatAUD(d.revenue)} <span className="muted">· {d.qty} sold</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

function PaymentShare({ payments }: { payments: SalesReport['payments'] }) {
  const [hover, setHover] = useState<string | null>(null)
  const shown = payments.filter((p) => p.amount > 0)
  if (shown.length === 0) return <p className="muted small chart-empty">No payments in this period yet.</p>
  return (
    <div className="share">
      <div className="share-bar" onMouseLeave={() => setHover(null)}>
        {shown.map((p) => (
          <span
            key={p.method}
            className={`seg seg-${p.method} ${hover === p.method ? 'hover' : ''}`}
            style={{ flexGrow: p.amount }}
            onMouseEnter={() => setHover(p.method)}
            title={`${p.label}: ${formatAUD(p.amount)} (${pct(p.share)})`}
          />
        ))}
      </div>
      <ul className="share-legend">
        {payments.map((p) => (
          <li key={p.method} className={hover === p.method ? 'hover' : ''}>
            <span className={`swatch seg-${p.method}`} />
            <span className="grow">{p.label}</span>
            <strong>{pct(p.share)}</strong>
            <span className="muted">{formatAUD(p.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

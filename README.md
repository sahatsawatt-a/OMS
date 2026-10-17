# OMS — Ordering Management System

Restaurant ordering with table QR codes, **pay first**, built for **Ying Thai 2** (Thai restaurant, Melbourne). When guests sit down, staff open a **table session** and show a QR code; guests scan it, order and pay at checkout (on their phone with Stripe, or at the counter), and staff bring the food to the table. Only paid orders go through; there is no bill at the end.

> **Current phase: working demo with a real backend.** FastAPI + MySQL hold the menu, tables, table sessions and orders; the server prices every order and confirms Stripe payments itself. The menu is Ying Thai 2's own printed menu (92 dishes, Thai names, dish numbers). Payments use Stripe **test mode**. Staff logins per person (REQ-28) and a kitchen screen are not part of this phase.

## Try it

```bash
cp .env.example .env && cp backend/.env.example backend/.env   # then fill in keys, see below
docker compose up -d --build
```

Open <http://localhost:5180>. Staff screens ask once for the **staff key** (`STAFF_API_KEY` in `backend/.env`).

| Screen          | Path                           | What to try                                                   |
| --------------- | ------------------------------ | ------------------------------------------------------------- |
| Home            | `/`                            | Overview, links to every screen; with the staff key: links to seated tables, reset sample data |
| Front of house  | `/staff`                       | Seat guests → QR code; take counter payments (Card / Cash); mark food served; clear the table when guests leave |
| Customer menu   | `/order?table=N&session=TOKEN` | Opened from the QR: Ying Thai 2's menu with Thai names and dish numbers, search by name, number or label (e.g. `32`, `gluten free`), options with exact printed prices, pay on phone (Stripe) or at the counter, follow orders, call waiter |
| Menu admin      | `/admin`                       | Add, edit, hide or delete dishes (price, photo, dietary labels, allergens, options); mark sold out; manage categories |
| Reports         | `/admin?tab=reports`           | Sales, busiest times, GST / BAS. Today's real orders plus generated sample history |

**Designs.** A thin demo bar on every screen switches between three looks, remembered per device; `?design=heritage|night|classic` in a link overrides it:

- **Heritage** (default): Ying Thai 2's printed menu, cream paper, navy serif, gold bands, numbered dishes.
- **Night**: their logo and website, near-black and gold, photo cards.
- **Classic**: clean and neutral.

The demo starts with sample tables: 2, 3, 5, 6 and 7 seated with orders at different stages, order #107 waiting at the counter. "Reset to sample data" on the home page puts that back. Dish photos are cut from Ying Thai 2's printed menu (`frontend/public/menu/yt/<dish number>.jpg`).

**Stripe test payments:** put your sandbox keys in `backend/.env` as `STRIPE_SECRET_KEY=sk_test_…` and `STRIPE_PUBLISHABLE_KEY=pk_test_…`, then `docker compose up -d backend`. "Pay on phone" opens Stripe's payment form; pay with test card `4242 4242 4242 4242`, any future expiry, any CVC. Without keys (and with `DEMO_MODE=true`) checkout shows a simulated card instead.

**Public link via ngrok:** put `NGROK_AUTHTOKEN` and `NGROK_URL` (your reserved ngrok domain) in `.env`, then run `docker compose --profile tunnel up -d`. Table QR codes then open on any phone.
The tunnel serves a **production build** (nginx, `web` service, also on <http://localhost:5181>), not the dev server. It does not live-reload: after code changes run `docker compose --profile tunnel up -d --build web`. The QR base URL is built in from `NGROK_URL`.

**Who can call the API:** staff and admin endpoints need the `X-Staff-Key` header (`STAFF_API_KEY`, or `BROWSER_CHECK_KEY` for the automated Zyrenn browser checks; remove that one to revoke them). Guest endpoints need an open table session token, which stops working when staff clear the table. Reading the menu, the health check and the Stripe publishable-key config are public.

| Layer    | Tech                                                   |
| -------- | ------------------------------------------------------ |
| Frontend | React 19 + TypeScript (Vite), React Router, Stripe.js  |
| Backend  | Python 3.12, FastAPI, SQLAlchemy 2, Alembic            |
| Payment  | Stripe (Payment Intents, deferred-intent Payment Element, webhooks) |
| Database | MySQL 8.4                                              |
| Dev env  | Docker Compose                                         |

## How it works

```
Staff seat guests ──► POST /api/tables/{id}/sessions ──► session token (QR: /order?table=N&session=TOKEN)
Guest opens QR     ──► GET  /api/sessions/{token}     ──► table, menu, this visit's orders
Guest pays first   ──► POST /api/sessions/{token}/orders {lines, pay: "stripe" | "counter"}
                         server prices the lines from the menu in MySQL
                         stripe:  PaymentIntent for that amount → card form → confirm-payment
                                  (server asks Stripe; the webhook does the same) → paid, numbered
                         counter: order #N waits until staff press Card / Cash
Staff              ──► GET  /api/staff/state (polled every 2 s): tables, sessions, orders, menu
                       counter-payment · served · close (refused while an order is unpaid)
```

Order numbers restart at 101 each day (Melbourne time). Money is integer cents, AUD, GST included.

## Project structure

```
OMS/
├── docker-compose.yml          # db + backend + frontend; web + ngrok with --profile tunnel
├── .env.example                # host ports, MySQL credentials, ngrok
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI app, CORS, router
│   │   ├── core/               # settings, staff-key check, clock (UTC, Melbourne business day)
│   │   ├── models/             # menu, tables & sessions, orders
│   │   ├── api/routes/         # menu, guest (session token), staff, payments (Stripe), demo
│   │   ├── services/           # order pricing and payment rules, API views
│   │   ├── menu_data.py        # Ying Thai 2's menu (from their printed menu)
│   │   └── seed.py             # python -m app.seed [--replace]: menu, tables, sample orders
│   ├── alembic/versions/       # 0001 schema, 0002 Thai names and dish numbers
│   └── tests/                  # pytest, SQLite in memory
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # routes: /, /staff, /order, /admin
│   │   ├── demo/store.ts       # API-backed store (polling) and actions
│   │   ├── components/         # shared UI, staff-key gate, design switch
│   │   ├── designs.css         # Heritage and Night designs over the base styles
│   │   ├── pages/              # customer, staff, admin (menu, reports), home
│   │   └── lib/api.ts          # fetch wrapper, staff key
│   └── public/menu/yt/         # dish photos by menu number
└── docs/REQUIREMENTS.md
```

## Full setup guide

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Docker Compose v2
- A [Stripe](https://dashboard.stripe.com/register) account (test mode is enough)
- Optional, for running things outside Docker: Node.js 20+ and Python 3.12+

### 1. Clone and configure

```bash
git clone <your-repo-url> OMS
cd OMS

cp .env.example .env                       # compose: ports, MySQL credentials, ngrok
cp backend/.env.example backend/.env       # backend: Stripe keys, staff key
cp frontend/.env.example frontend/.env     # frontend: public base URL for QR codes
```

| File            | Variable                  | Value                                         |
| --------------- | ------------------------- | --------------------------------------------- |
| `backend/.env`  | `STRIPE_SECRET_KEY`       | `sk_test_...`                                 |
| `backend/.env`  | `STRIPE_PUBLISHABLE_KEY`  | `pk_test_...` (sent to the browser by the API) |
| `backend/.env`  | `STRIPE_WEBHOOK_SECRET`   | `whsec_...` (step 4)                          |
| `backend/.env`  | `STAFF_API_KEY`           | a long random string; staff type it once per device |
| `backend/.env`  | `BROWSER_CHECK_KEY`       | optional second key for automated browser checks |
| `backend/.env`  | `DEMO_MODE`               | `true` allows sample-data reset and simulated payments |

`.env` files are git-ignored. Never commit real keys.

### 2. Start the stack

```bash
docker compose up -d --build
```

| Service  | URL                                | Notes                                  |
| -------- | ---------------------------------- | -------------------------------------- |
| Frontend | <http://localhost:5180>            | Vite dev server with hot reload        |
| Backend  | <http://localhost:8000/api/health> | FastAPI with `--reload`                |
| API docs | <http://localhost:8000/docs>       | Swagger UI                             |
| MySQL    | `localhost:3306`                   | user `oms` / password `oms`, db `oms`  |

If a port is already in use on your machine, change `FRONTEND_PORT`, `BACKEND_PORT` or `MYSQL_PORT` in `.env` and run `docker compose up -d` again.

On start the backend runs `alembic upgrade head` and `python -m app.seed`, which fills an empty database with the menu, 8 tables and (in demo mode) sample orders. An older demo database with the previous sample menu can be replaced with `docker compose exec backend python -m app.seed --replace` (demo mode only; it deletes all orders).

### 3. Check it works

```bash
curl http://localhost:8000/api/health
# {"status":"ok","database":"ok"}
```

### 4. Stripe webhooks (local)

The server already confirms each payment with Stripe when the guest's browser reports it; the webhook is the backup for guests who close the page. Install the [Stripe CLI](https://docs.stripe.com/stripe-cli), then:

```bash
stripe login
stripe listen --forward-to localhost:8000/api/payments/webhook
```

Copy the `whsec_...` secret it prints into `backend/.env` as `STRIPE_WEBHOOK_SECRET`, then `docker compose up -d backend`.

## Everyday commands

```bash
docker compose logs -f backend                 # follow backend logs
docker compose exec backend pytest             # run backend tests
docker compose exec backend ruff check .       # lint backend
docker compose exec frontend npm run lint      # lint frontend
docker compose exec db mysql -uoms -poms oms   # MySQL shell
docker compose down                            # stop (keeps data)
docker compose down -v                         # stop and wipe the database
```

### Database migrations

After adding or changing a model in `backend/app/models/` (and importing it in `models/__init__.py`):

```bash
docker compose exec backend alembic revision --autogenerate -m "add refunds"
docker compose exec backend alembic upgrade head
```

### Adding dependencies

```bash
# Backend: add the pinned package to backend/requirements.txt, then
docker compose up -d --build backend

# Frontend
docker compose exec frontend npm install <package>
```

## Browser checks

Two Zyrenn suites run against the public demo (project **OMS** → Checks): **Ying Thai 2: each part** (18 checks, one per screen and rule) and **Ying Thai 2: end to end** (one table from seating to clearing, with captions so it can be filmed as a demo). They sign in with `BROWSER_CHECK_KEY`, stored in the suites as a hidden value, and start with "Reset to sample data".

## Requirements

See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md). They are also tracked in the Zyrenn project **OMS** (Product → Requests / Requirements).

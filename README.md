# OMS — Ordering Management System

Restaurant ordering with table QR codes. When guests sit down, staff open a **table session** and show a QR code; guests scan it, order from their phone in rounds, the kitchen sees the orders live, and the bill is paid by phone (Stripe) or at the table.

> **Current phase: frontend demo.** The React app runs on mock data stored in the browser, so you can click through the whole flow without the backend. The FastAPI + MySQL backend is scaffolded but not implemented yet.

## Try the demo (fastest)

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Or with Docker: `docker compose up -d --build`, then open <http://localhost:5180>.

| Screen          | Path                           | What to try                                                   |
| --------------- | ------------------------------ | ------------------------------------------------------------- |
| Home            | `/`                            | Overview, links to every screen, reset sample data            |
| Front of house  | `/staff`                       | Tap a free table → seat guests → QR code; open a seated table; settle the bill |
| Customer menu   | `/order?table=N&session=TOKEN` | Opened from the QR: search dishes, dietary labels and allergens, order, follow status, call waiter, pay. Adapts to phone, iPad and PC |

Menu photos are openly licensed images from Wikimedia Commons (credits in [frontend/public/menu/CREDITS.md](frontend/public/menu/CREDITS.md) and on the menu's "Photo credits" link).

The demo starts with sample data (tables 2, 3, 5, 6 and 7 seated with orders at different stages). Open Front of house and a Customer menu in separate tabs of the same browser and they update each other live.

**Stripe test payments:** put your Stripe sandbox keys in `backend/.env` (or the root `.env`) as `STRIPE_SECRET_KEY=sk_test_…` and `STRIPE_PUBLISHABLE_KEY=pk_test_…`, then `docker compose up -d --force-recreate backend`. "Pay now" on the customer menu then opens Stripe's real payment form (card); pay with test card `4242 4242 4242 4242`, any future expiry, any CVC. Without keys it falls back to a simulated checkout. This is the only backend piece in phase 1: it creates the payment and confirms it with Stripe; the bill amount still comes from the browser's mock data.

**Public link via ngrok:** put `NGROK_AUTHTOKEN` and `NGROK_URL` (your reserved ngrok domain) in `.env`, set `VITE_PUBLIC_BASE_URL=https://<NGROK_URL>` in `frontend/.env`, then run `docker compose --profile tunnel up -d`. Table QR codes will then open on any phone.

**Scanning with a real phone on the same Wi-Fi (no ngrok):** set `VITE_PUBLIC_BASE_URL` in `frontend/.env` to your computer's LAN address (e.g. `http://192.168.1.20:5180`) so the QR code points somewhere the phone can reach. Because demo data lives in each browser, the phone will offer to continue that table's session locally.

| Layer    | Tech                                                   |
| -------- | ------------------------------------------------------ |
| Frontend | React 19 + TypeScript (Vite), React Router, Stripe.js  |
| Backend  | Python 3.12, FastAPI, SQLAlchemy 2, Alembic            |
| Payment  | Stripe (Payment Intents + webhooks)                    |
| Database | MySQL 8.4                                              |
| Dev env  | Docker Compose                                         |

## Project structure

```
OMS/
├── docker-compose.yml        # db + backend + frontend for local development
├── .env.example              # host ports and MySQL credentials for compose
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app, CORS, router
│   │   ├── core/config.py    # settings read from environment / .env
│   │   ├── db/               # SQLAlchemy Base and session
│   │   ├── models/           # ORM models (import them in models/__init__.py)
│   │   └── api/routes/       # health, payments (Stripe webhook), ...
│   ├── alembic/              # database migrations
│   ├── tests/
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # routes: /, /staff, /order (kitchen page kept, not routed)
│   │   ├── demo/             # mock data, seed, browser store (stands in for the API)
│   │   ├── pages/            # customer, staff, kitchen, home screens
│   │   ├── components/       # shared UI, icons, formatting helpers
│   │   └── lib/api.ts        # fetch wrapper for the future backend API
│   └── vite.config.ts        # dev server proxies /api to the backend
└── docs/
    └── REQUIREMENTS.md       # collected requirements
```

## Full setup guide (with backend)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Docker Compose v2
- A [Stripe](https://dashboard.stripe.com/register) account (test mode is enough)
- Optional, for running things outside Docker: Node.js 20+ and Python 3.12+

### 1. Clone and configure

```bash
git clone <your-repo-url> OMS
cd OMS

cp .env.example .env                       # compose: ports + MySQL credentials
cp backend/.env.example backend/.env       # backend: Stripe keys, etc.
cp frontend/.env.example frontend/.env     # frontend: Stripe publishable key
```

Then fill in your Stripe test keys from <https://dashboard.stripe.com/test/apikeys>:

| File            | Variable                       | Value                  |
| --------------- | ------------------------------ | ---------------------- |
| `backend/.env`  | `STRIPE_SECRET_KEY`            | `sk_test_...`          |
| `backend/.env`  | `STRIPE_WEBHOOK_SECRET`        | `whsec_...` (step 4)   |
| `frontend/.env` | `VITE_STRIPE_PUBLISHABLE_KEY`  | `pk_test_...`          |

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

The backend runs `alembic upgrade head` on start, so the database schema is always current.

### 3. Check it works

Open <http://localhost:5180> for the demo home page. The backend health check:

```bash
curl http://localhost:8000/api/health
# {"status":"ok","database":"ok"}
```

### 4. Stripe webhooks (local)

Install the [Stripe CLI](https://docs.stripe.com/stripe-cli), then:

```bash
stripe login
stripe listen --forward-to localhost:8000/api/payments/webhook
```

Copy the `whsec_...` secret it prints into `backend/.env` as `STRIPE_WEBHOOK_SECRET`, then restart the backend:

```bash
docker compose restart backend
```

Trigger a test event with `stripe trigger payment_intent.succeeded`.

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
docker compose exec backend alembic revision --autogenerate -m "add orders table"
docker compose exec backend alembic upgrade head
```

### Adding dependencies

```bash
# Backend: add the pinned package to backend/requirements.txt, then
docker compose up -d --build backend

# Frontend
docker compose exec frontend npm install <package>
```

## Requirements

See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md). They are also tracked in the Zyrenn project **OMS** (Product → Requests / Requirements).

# OMS — Ordering Management System

An ordering management system: customers browse products, place orders and pay online; staff manage the catalogue, orders and fulfilment.

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
│   │   ├── App.tsx
│   │   └── lib/api.ts        # fetch wrapper for the backend API
│   └── vite.config.ts        # dev server proxies /api to the backend
└── docs/
    └── REQUIREMENTS.md       # collected requirements
```

## Setup guide

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

Open <http://localhost:5180>. The page should show `API status: ok, database ok`.

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

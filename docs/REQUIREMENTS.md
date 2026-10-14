# OMS — Requirements (draft v0.2)

**Restaurant dine-in ordering with table QR codes.**

Status: draft. Requirements marked *assumption* and the open questions in section 8 still need answers from the restaurant. Tracked in Zyrenn → project **OMS** → Product. Requirement codes (REQ-n) below match Zyrenn.

| Version | Date       | Change                                                                 |
| ------- | ---------- | ---------------------------------------------------------------------- |
| 0.1     | 2026-10-14 | Generic online shop baseline (RQ-1)                                     |
| 0.2     | 2026-10-14 | Reworked for restaurant dine-in QR ordering (RQ-2); phase 1 = frontend demo (RQ-3) |

## 1. Requests (word for word)

- **RQ-1:** "Ordering Management System. Frontend: React, Backend: Python, Payment: Stripe, Database: MySQL"
- **RQ-2:** "this will be for restaurant. the flow will start from when customer walk in to shop and sit down, we'll generate QR code that contain table number (just for reference of which table we need to serve to) and session (to track the order data and state). then the menu will appear to select."
- **RQ-3:** "I need only frontend demo. no backend implementation yet."

## 2. The flow

```
Guests sit down
   → Staff open a session for the table → QR code (table number + session token)
   → Guests scan → menu opens on their phone (no app, no login)
   → Guests order in rounds → kitchen display
   → Kitchen: cooking → ready → staff serve
   → Guests call waiter / ask for bill → pay by phone (Stripe) or at the table
   → Session closes, QR stops working, table is free
```

**Table session:** one seating at one table, from guests sitting down until the bill is paid. Every order belongs to a session. The QR link carries the table number for display only; the backend routes orders by the session token.

## 3. Users

| Role    | Who                       | Uses                                    |
| ------- | ------------------------- | --------------------------------------- |
| Diner   | Guest at a table          | Customer menu on their own phone; no account |
| Waiter  | Front-of-house staff      | Staff app: seat guests, QR, serve, settle bills |
| Kitchen | Cooks / bar               | Kitchen display                         |
| Admin   | Owner / manager           | Back office: menu, tables, refunds, reports |

## 4. Product structure

| Component                     | Capabilities                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------- |
| CMP-1 Customer menu (QR)      | Browse menu, build order, send to kitchen, follow orders & running bill, call waiter / request bill, pay from phone |
| CMP-5 Staff app               | Open table session & generate QR, table overview, manage table orders, settle bill & close session |
| CMP-6 Kitchen display         | See incoming items, update item status                                      |
| CMP-2 Admin back office       | Manage menu, manage tables, mark items sold out, refunds, sales dashboard  |
| CMP-3 Backend API             | Staff login & roles, table sessions & QR tokens, order/item lifecycle, real-time updates |
| CMP-4 Payments (Stripe)       | Payment Intents, webhooks, refunds                                          |

**Item lifecycle:** `submitted → preparing → ready → served`, or `cancelled` (by staff, before it is ready).
**Session lifecycle:** `open → closed` (closed when the bill is fully paid).

## 5. Functional requirements

Priority: **H** first release, **N** normal, **L** later.

### Seating and QR
**REQ-16 Staff open a table session and generate a QR code (H)**
- Staff pick a free table and open a session; a QR code is produced whose link contains the table number and a session token.
- The token is random and unguessable (≥128 bits). A table has at most one open session.
- The table number in the link is display-only; orders are routed by the session's table.
- When the session closes, the QR no longer allows ordering.

**REQ-17 Scanning the QR opens the menu for that session (H)**
- Opens in the phone browser with no install or login, and shows the table number.
- An invalid or closed session shows "please ask our staff" and blocks ordering.
- Several phones at the same table can join the same session.

### Ordering
**REQ-18 Diners browse and search the menu (H)** — search by dish name, description, category or option as you type; categories with quick navigation; name, price, description (photo when available); sold-out items shown but not orderable; usable one-handed from 360px wide.

**Dietary labels and allergens (H, from RQ-7)** — each dish shows Vegetarian / Vegan / Vegetarian option / Halal and the allergens it contains (dairy, peanuts, tree nuts, shellfish, egg); dish details remind diners to tell staff about allergies; labels are searchable. *Open:* halal certification, required allergen list, filters.

**REQ-19 Diners build an order with quantities, options and notes (H)** — add/change/remove items; pick options (e.g. protein, spice level, paid extras); free-text note; totals include option prices; cart survives a reload.

**REQ-20 Diners send orders to the kitchen in rounds (H)** — sending creates an order round on the session; items reach the kitchen display within seconds; any number of rounds while the session is open; each item keeps its price at time of ordering; diner sees confirmation.

**REQ-21 Diners follow item status and the running bill (N)** — every item with status (sent, cooking, ready, served, cancelled), updated live; running total with service charge and VAT.

**REQ-24 Diners can call a waiter and ask for the bill (N)** — one tap; staff see an alert with the table number; staff acknowledge to clear it.

### Kitchen and floor
**REQ-22 Kitchen sees incoming items and marks them cooking and ready (H)** — live queue, oldest first, with table, quantity, options and notes; late items highlighted; only allowed status changes.

**REQ-23 Staff see all tables and manage their orders (H)** — table overview (free / seated / ready to serve / bill requested); open a table to see its orders; mark ready items served; add items for guests without phones; cancel items not yet cooking.

**REQ-27 Staff and kitchen can mark items sold out (N)** — one-tap toggle; sold-out items can't be ordered; diners see it live. No ingredient-level stock tracking (*assumption*).

### Payment
**REQ-25 The table bill is paid by Stripe on the phone or at the counter, then the session closes (H)**
- Bill lists all non-cancelled items with subtotal, service charge, VAT and total.
- Diner can pay on their phone with Stripe (card data never reaches our servers); staff can record cash or card-terminal payment instead.
- A Stripe payment counts only after a signature-verified webhook.
- When fully paid, the session closes, the QR stops working and the table becomes free.
- *Assumptions:* pay once at the end of the meal; THB; 10% service charge and 7% VAT added on top.

**REQ-10 Admins can refund fully or partially through Stripe (N)**

### Administration
**REQ-26 Admins manage the menu and tables (H)** — categories, items, prices, photos, option groups; tables (number, seats, zone); items/tables used in past orders are hidden, never deleted.

**REQ-28 Staff log in with roles; diners need no account (H)** — roles waiter, kitchen, admin; each sees only its screens.

**REQ-12 Sales dashboard and CSV export (L)**

## 6. Non-functional requirements

- **REQ-13 Stack (constraint):** React + TypeScript frontend, Python (FastAPI) backend, Stripe, MySQL; Docker Compose for local dev.
- **REQ-29 Phase 1 is a frontend-only demo with mock data (constraint).** See section 7.
- **REQ-14 Security:** no card data on our servers; verified Stripe webhooks; secrets only in env vars; HTTPS; backend input validation. Session tokens unguessable and useless once closed.
- **REQ-15 Money and records:** amounts as integer satang with currency; orders/payments never hard-deleted; schema changes via migrations; daily backups.
- **Usability (RQ-6):** guest ordering works on phone (single column), iPad portrait (grid of dish cards) and iPad landscape / PC (menu grid with the order always visible in a side panel); staff app works on tablet and phone; kitchen display readable at a distance.
- **Real-time:** order and status changes reach other screens within ~2 seconds (WebSocket/SSE in the real system).

## 7. Phase 1: frontend demo (current)

Built in `frontend/` with mock data; no backend calls.

| Screen          | URL                                  | Shows                                                          |
| --------------- | ------------------------------------ | -------------------------------------------------------------- |
| Home            | `/`                                  | Entry point, flow explanation, reset sample data               |
| Front of house  | `/staff`                             | Table grid, alerts, seat guests → QR, table detail, settle bill |
| Kitchen display | (not routed)                         | Code kept in `pages/kitchen/`; removed from the routes for now |
| Customer menu   | `/order?table=N&session=TOKEN`       | Menu, options, cart, send to kitchen, order status, bill, simulated Stripe payment |

- **Sample data:** 8 tables and an 18-item Thai menu. Tables 2, 3, 5, 6 and 7 are seated with orders at every stage, plus a waiter call and a bill request. Two items are sold out.
- **State** lives in the browser (`localStorage`), so tabs in the same browser update each other live. A phone scanning a QR made on another device can't see that browser's data; it offers to continue the session locally instead.
- **Payment** uses real Stripe in sandbox mode when keys are set (card and PromptPay, confirmed server-side by `POST /api/payments/intents` and `GET /api/payments/intents/{id}`); otherwise simulated. The amount comes from the browser's mock bill, which the real backend must calculate itself.
- **Search** filters the menu as you type.

## 8. Open questions

1. **Payment timing:** pay at the end of the meal, or pay for each order before it goes to the kitchen?
2. **Service charge and VAT:** is there a service charge (10%?), and are menu prices VAT-inclusive? Tax invoices needed?
3. **Split bill** between diners?
4. **Payment methods:** cards, PromptPay, cash?
5. **QR delivery:** printed slip, or shown on a staff tablet / table stand?
6. **Shared phones:** do phones at one table share a cart, or each keep their own cart on the same table bill?
7. **Order approval:** must staff confirm a diner's order before it goes to the kitchen?
8. **Kitchen output:** display screen, ticket printer, or both? Separate stations (kitchen vs bar)?
9. **Menu:** Thai and English? Real item options and paid extras?
10. **Table changes:** move a session to another table, or merge tables?
11. **Staff login:** PIN on a shared tablet, or personal accounts?
12. **Scale & timeline:** number of tables, staff and daily covers; target date for a pilot.

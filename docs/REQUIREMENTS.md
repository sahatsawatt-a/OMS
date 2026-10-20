# OMS — Requirements (draft v0.4)

**Restaurant dine-in ordering with table QR codes, pay first, for Ying Thai 2 (Thai restaurant, Melbourne).**

Status: draft. Requirements marked *assumption* and the open questions in section 8 still need answers from the restaurant. Tracked in Zyrenn → project **OMS** → Product. Requirement codes (REQ-n) and request codes (RQ-n) below match Zyrenn.

| Version | Date       | Change                                                                 |
| ------- | ---------- | ---------------------------------------------------------------------- |
| 0.1     | 2026-10-14 | Generic online shop baseline (RQ-1)                                     |
| 0.2     | 2026-10-14 | Reworked for restaurant dine-in QR ordering (RQ-2); phase 1 = frontend demo (RQ-3) |
| 0.3     | 2026-10-15 | Customer is Ying Thai 2 (Thai restaurant, Melbourne): AUD prices including 10% GST, no service charge (PR #1, RQ-8) |
| 0.3.1   | 2026-10-16 | Pay first; kitchen screen left out (RQ-11)                              |
| 0.4     | 2026-10-17 | Backend and MySQL for menu, table sessions and Stripe pay-first orders (RQ-12, REQ-32); API keys (RQ-14); Ying Thai 2's real menu (RQ-19); three switchable guest templates (RQ-18, RQ-20, RQ-23); kitchen control removed for now (RQ-21) |

## 1. Requests (word for word)

- **RQ-1:** "Ordering Management System. Frontend: React, Backend: Python, Payment: Stripe, Database: MySQL"
- **RQ-2:** "this will be for restaurant. the flow will start from when customer walk in to shop and sit down, we'll generate QR code that contain table number (just for reference of which table we need to serve to) and session (to track the order data and state). then the menu will appear to select."
- **RQ-3:** "I need only frontend demo. no backend implementation yet."
- **RQ-4:** "now test payment with stripe. I have sandbox for API key."
- **RQ-5:** "also add food search"
- **RQ-6:** "order for guest should not be only mobile mode. it could be Ipad or pc"
- **RQ-7:** "also add info about vegetarian or halal or dairy product too"
- **RQ-8 (PR #1 by MikkiSnowz):** "Feat/aud dollar change title" — rename to Ying Thai 2, Melbourne; prices in Australian dollars.
- **RQ-9:** "add admin page that can update menu data."
- **RQ-10:** "add report tab in admin page"
- **RQ-11:** "Just leave out anything that relates to kitchen control like no.8 and I want to focus on pay first system. Like order and pay then get food. Like what fast food did"
- **RQ-12:** "let just set up backend and db for menu, qr session for table, and stripe payment."
- **RQ-13:** "use full capability of zyrenn to help us dev and make a relevant doc and presentation for demo to customer."
- **RQ-14:** "yes, use api but only those with key can call"
- **RQ-15:** "also update the existing info we have"
- **RQ-16:** "and look for how people ususally desiign these system. for ui"
- **RQ-17:** "once every thing in place I want you to browser check but 1 suite for check each part and 1 suite for end to end after everthing working as intended"
- **RQ-18:** "I also want you to make multiple tpye of ui so that customer can toggle to choose with diff in design"
- **RQ-19:** "maybe follow their website https://yingthai2.com.au/menu & https://yingthai2.com.au/gallery"
- **RQ-20:** "and might use that as a base of one of ui design too"
- **RQ-21:** "also ewmove kitchen control for now"
- **RQ-22:** "we planning to make it pay right at order" *(clarifying: keep "Pay at counter" as a choice, or phone payment only?)*
- **RQ-23:** "the ui you did was a theme color. I want a different UI design, diff template."
- **RQ-24 / RQ-25:** "this part also feel weird" / "this feel weird" (Front of house alerts layout; guest menu section bar)

## 2. The flow

```
Guests sit down
   → Staff open a session for the table → QR code (table number + session token)
   → Guests scan → menu opens on their phone (no app, no login)
   → Guests order → checkout: pay on phone (Stripe) or choose "Pay at counter"
   → Paid orders go through (counter orders once staff confirm Card / Cash)
   → Staff bring the food to the table and mark it served
   → Guests can order and pay again any time; no bill at the end
   → Staff clear the table when guests leave; QR stops working
```

**Table session:** one seating at one table, from guests sitting down until staff clear the table. **Pay first (RQ-11):** each order is paid when it is placed. Every order belongs to a session. The QR link carries the table number for display only; the backend routes orders by the session token. **No kitchen screen for now (RQ-21):** paid orders show on Front of house, and staff mark food served.

## 3. Users

| Role    | Who                       | Uses                                    |
| ------- | ------------------------- | --------------------------------------- |
| Diner   | Guest at a table          | Customer menu on their own phone; no account |
| Staff   | Front of house            | Front of house: seat guests, QR, counter payments, serve, clear tables (staff key) |
| Admin   | Owner / manager           | Menu admin and reports (staff key)      |

Per-person staff logins and roles (REQ-28) are not built yet; one shared staff key protects the staff and admin screens.

## 4. Product structure

| Component                     | Capabilities                                                                 | Status |
| ----------------------------- | ---------------------------------------------------------------------------- | ------ |
| CMP-1 Customer menu (QR)      | Browse menu (three templates), build order, pay at checkout (phone or counter), follow orders, call waiter | Built, on the API |
| CMP-5 Staff app               | Open table session & QR, table overview, needs-attention queue, counter payments, serve, clear | Built, on the API |
| CMP-6 Kitchen display         | See incoming items, update item status                                      | Removed for now (RQ-21) |
| CMP-2 Admin back office       | Manage menu, mark sold out, reports; refunds and tables later               | Built (refunds, table editing later) |
| CMP-3 Backend API             | Staff key, table sessions & QR tokens, order lifecycle, live updates over a WebSocket; per-person logins later | Built (REQ-32) |
| CMP-4 Payments (Stripe)       | Payment Intents priced by the server, server-side confirmation, webhooks; refunds later | Built, test mode |

**Item lifecycle:** `submitted → served`, or `cancelled` (unpaid counter orders). The kitchen states `preparing` and `ready` are removed for now.
**Session lifecycle:** `open → closed` (staff clear the table; refused while a counter order is unpaid).

## 5. Functional requirements

Priority: **H** first release, **N** normal, **L** later.

### Seating and QR
**REQ-16 Staff open a table session and generate a QR code (H)** — staff pick a free table and open a session; the QR link holds the table number and a random token (128 bits); one open session per table (enforced by the database); a closed session's QR no longer works.

**REQ-17 Scanning the QR opens the menu for that session (H)** — no install or login; shows the table number; an unknown token says the QR is not valid, a closed one thanks the guest; several phones can join the same session.

### Ordering
**REQ-18 Diners browse and search the menu (H)** — Ying Thai 2's own menu (92 dishes, 11 sections, dish numbers and Thai names as printed); search by name, Thai name, number (`32`), section, option or label (`gluten free`) as you type; sold-out dishes shown but not orderable.

**Dietary labels and allergens (H, RQ-7)** — the printed menu's marks: gluten free, peanuts, cashew nuts, spicy; "vegetarian option" where a vegetable choice exists. Diners are told to check allergies with staff. *Open:* halal, full allergen list.

**REQ-19 Diners build an order with quantities, options and notes (H)** — options follow the printed menu so every total matches it: protein tiers (e.g. Pad Thai $20.90, prawns or seafood +$4), Bowl / Hot pot, Whole / Fillet fish, ice level; free-text note; cart survives a reload.

**REQ-21 Diners follow their orders (N)** — every order with its number, payment and item status, updated within a few seconds.

**REQ-24 Diners can call a waiter (N)** — one tap; staff see it in "Needs attention" and acknowledge it.

**Guest templates (RQ-18, RQ-20, RQ-23)** — three switchable layouts, each with its own look: **Classic** (one scrolling list with a section bar; order panel beside the menu on wide screens), **Menu book** (Ying Thai 2's printed menu: one section per page, numbered dishes with dotted price leaders, contents, cream / navy / gold), **Photo feed** (delivery-app style: popular carousel, photo rows per section, bottom tab bar; their logo's gold on black). Remembered per device; `?design=` in a link overrides it.

### Floor
**REQ-23 Staff see all tables and manage their orders (H)** — table grid with Free / Seated / Pay at counter / Food to serve; a "Needs attention" queue beside it (counter payments, waiter calls); open a table to see its orders, mark food served, show its QR, clear it.

**REQ-27 Staff can mark items sold out (N)** — one tap in Menu admin; guests see it within seconds; a paid order is never lost to a dish selling out meanwhile.

### Payment
**REQ-25 Pay first: each order is paid when it is placed, on the phone or at the counter (H)**
- Checkout shows the order and total with GST included; the guest pays on their phone with Stripe (card details never reach our server) or chooses "Pay at counter".
- The server prices every order from the menu in the database; the browser never sends an amount.
- A phone order is placed only after the server confirms the payment with Stripe (and the verified webhook does the same as a backup).
- A counter order waits with an order number; staff confirm Card or Cash, then it goes through. Unpaid counter orders can be cancelled; a table can't be cleared while one is waiting.
- *Assumptions:* AUD; menu prices include 10% GST; no service charge. *Open (RQ-22):* drop "Pay at counter" so every order is paid on the phone?

**REQ-10 Admins can refund fully or partially through Stripe (N)** — not built.

### Administration
**REQ-26 Admins manage the menu (H)** — sections, dishes, Thai names, dish numbers, prices, photos, option groups, labels; dishes in past orders are hidden, never deleted. Table editing not built yet.

**REQ-28 Staff log in with roles; diners need no account (H)** — partly: one shared staff key (and a separate, revocable key for automated checks); per-person logins and roles still to do.

**REQ-12 Sales reports and CSV export (L)** — Sales, Busiest times, GST / BAS with accountant CSV; real orders plus generated sample history for the demo.

### Backend (phase 2)
**REQ-32 Backend and MySQL hold the menu, table sessions with QR tokens, and Stripe pay-first orders (H)** — changes REQ-29. FastAPI + SQLAlchemy + Alembic (migrations 0001, 0002); staff endpoints need `X-Staff-Key`; guest endpoints need an open session token; menu read is public. 56 backend tests; browser checks "Ying Thai 2: each part" (18 checks) and "Ying Thai 2: end to end" (one table, seat to clear) in Zyrenn.

## 6. Non-functional requirements

- **REQ-13 Stack (constraint):** React + TypeScript frontend, Python (FastAPI) backend, Stripe, MySQL; Docker Compose for local dev.
- **REQ-14 Security:** no card data on our servers; verified Stripe webhooks; secrets only in env vars; HTTPS on the public demo; backend input validation; session tokens unguessable and useless once closed; staff key compared in constant time; no key configured = staff screens locked.
- **REQ-15 Money and records:** amounts as integer cents with currency; orders/payments never hard-deleted (except the demo's "reset sample data"); schema changes via migrations; daily backups *(not set up yet)*.
- **Usability (RQ-6):** guest ordering works on phone, iPad and PC; staff app works on tablet and phone.
- **Live updates:** a WebSocket (`/api/ws`) tells screens when data changed and they reload it (REQ-34); a 30-second safety refresh covers missed notices. Uploaded dish photos are served as separate cached files (REQ-35).

## 7. Phase 2: working demo (current)

| Screen          | URL                                  | Shows                                                          |
| --------------- | ------------------------------------ | -------------------------------------------------------------- |
| Home            | `/`                                  | Entry point; with the staff key: seated-table links, reset sample data |
| Front of house  | `/staff`                             | Table grid, Needs attention queue, seat guests → QR, table detail, counter payments, serve, clear |
| Customer menu   | `/order?table=N&session=TOKEN`       | The real menu in the chosen template, options, cart, pay on phone (Stripe test mode) or at the counter, orders, call waiter |
| Menu admin      | `/admin`                             | Dishes (Thai name, number, price, photo, labels, options), sold out, hidden, sections |
| Reports         | `/admin?tab=reports`                 | Sales, Busiest times, GST / BAS                                 |

- **Sample data:** 8 tables; tables 2, 3, 5, 6 and 7 seated with orders at every stage (order #107 waiting at the counter); Coconut Juice and Poo Pud Num Prik Pow sold out. "Reset to sample data" restores it.
- **Public demo:** the ngrok link serves a production build; everyone using it shares one database.
- **Menu source:** transcribed from Ying Thai 2's printed menu; obvious typos corrected (e.g. "Stir-friend", "wraped", "chiken"); dish photos cut from the printed menu. Items 78, 79 and 92 have no Thai name on the printed menu.

## 8. Open questions

1. ~~Payment timing~~ **Decided 2026-10-16: pay first.** **RQ-22:** keep "Pay at counter" as a choice, or phone payment only?
2. **Surcharges and GST:** any Sunday/public-holiday or card surcharge? Are tax invoices needed (required on request for sales over $82.50 incl. GST)?
3. **Split bill** between diners?
4. **Payment methods:** Apple Pay / Google Pay (needs the domain registered with Stripe), cash at the counter?
5. **Stripe account:** the sandbox is a Thai account (AUD converted, higher fees); an Australian account for live?
6. **QR delivery:** printed slip, or shown on a staff tablet / table stand? Short link under the QR?
7. **Shared phones:** do phones at one table share a cart, or each keep their own?
8. **Kitchen output (later):** display screen, ticket printer, or both? Separate kitchen and bar?
9. **Menu:** confirm the transcribed menu, dietary marks and photos; Thai / English toggle?
10. **Which template** should guests see by default?
11. **Staff login:** PIN on a shared tablet, or personal accounts?
12. **Scale & timeline:** number of tables, staff and daily covers; pilot date.

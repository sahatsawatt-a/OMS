# OMS — Requirements (draft v0.1)

Status: **draft, not yet confirmed.** Everything below except the tech stack is a proposed baseline for a typical online ordering system. Items marked *assumption* need to be confirmed, and the open questions at the end must be answered before building starts.

Tracked in Zyrenn → project **OMS** → Product (request RQ-1, requirements REQ-n).

## 1. Original request

> Ordering Management System
> Frontend: React
> Backend: Python
> Payment: Stripe
> Database: MySQL

## 2. Users and roles

| Role         | Who                                  | Main goals                                         |
| ------------ | ------------------------------------ | -------------------------------------------------- |
| Guest        | Visitor without an account           | Browse products                                    |
| Customer     | Registered buyer                     | Order, pay, track orders, see order history        |
| Staff        | Shop / operations team               | Process orders, update status, manage stock        |
| Admin        | Owner / manager                      | Everything staff can do + products, refunds, users, reports |

## 3. Product structure

| Component              | Capabilities                                                                 |
| ---------------------- | ---------------------------------------------------------------------------- |
| Customer storefront    | Browse catalogue, search/filter, product detail, cart, checkout, order history and tracking, account |
| Admin back office      | Product & category management, order management, inventory, refunds, customer list, sales dashboard |
| Backend API            | Authentication & roles, order service, inventory service, notifications      |
| Payments (Stripe)      | Payment Intents, webhook handling, refunds (shared by storefront and back office) |

## 4. Functional requirements

Priority: **H** = needed for first release (MVP), **N** = normal, **L** = later.

### Accounts

**FR-1 Customer accounts and staff roles (H)**
- A visitor can register with email and password, log in and log out.
- Passwords are stored hashed (bcrypt/argon2), never in plain text.
- Every user has one role: customer, staff or admin. API endpoints check the role.
- A customer can reset a forgotten password by email.

### Storefront

**FR-2 Product catalogue (H)**
- Customers see active products with name, image, price, and in-stock / out-of-stock state.
- Products can be filtered by category and searched by name.
- A product detail page shows description, price, images and availability.
- Inactive products are not shown and cannot be ordered.

**FR-3 Shopping cart (H)**
- A customer can add, change quantity of, and remove items.
- The cart shows line totals and the order total, recalculated by the backend (prices from the browser are never trusted).
- The cart survives a page reload.
- A customer cannot add more of an item than is in stock.

**FR-4 Checkout and order placement (H)**
- At checkout the customer enters contact details and delivery/pickup information.
- Placing an order creates it with status `pending_payment` and a unique order number.
- Order lines keep the price at the time of ordering, even if the product price changes later.

**FR-5 Online payment with Stripe (H)**
- Payment uses Stripe Payment Intents with Stripe Elements; card data never touches our servers.
- An order becomes `paid` only when the backend receives a verified `payment_intent.succeeded` webhook, not because the browser says so.
- A failed or abandoned payment leaves the order `pending_payment`; the customer can retry.
- Each webhook event is processed at most once (idempotent by event id).
- Unpaid orders are cancelled automatically after a set time (*assumption: 30 minutes*) and their stock is released.

**FR-6 Order history and tracking (N)**
- A customer sees a list of their orders with number, date, total and status.
- An order detail page shows its lines, payment state and status history.

### Back office

**FR-7 Product and category management (H)**
- Admin can create, edit, deactivate and delete products: name, description, price, category, images, SKU, stock quantity, active flag.
- Admin can create, rename and delete categories.

**FR-8 Order management (H)**
- Staff see all orders, filterable by status, date range and customer, and searchable by order number.
- Staff move an order through its lifecycle:
  `pending_payment → paid → preparing → ready_for_pickup / shipped → completed`, with `cancelled` and `refunded` as end states.
- Only allowed transitions are accepted; every change is recorded with who made it and when.
- Staff can add internal notes to an order.

**FR-9 Inventory tracking (N)**
- Stock is reserved when an order is placed and released when it is cancelled or expires.
- Two customers cannot both buy the last unit (stock is updated in a transaction with row locking).
- Staff can adjust stock manually, with a reason.
- Products with stock below a threshold are flagged.

**FR-10 Refunds (N)**
- Admin can refund a paid order fully or partially through Stripe from the back office.
- The order shows the refunded amount; a full refund sets status `refunded`.
- Refunds made directly in the Stripe dashboard are picked up by webhook (`charge.refunded`).

**FR-11 Email notifications (N)**
- Customer gets an email when an order is paid, and when it is shipped / ready for pickup.
- Staff get an email (or in-app alert) for each new paid order.

**FR-12 Sales dashboard (L)**
- Admin sees orders and revenue per day/week/month, top-selling products, and order counts by status.
- Data can be exported as CSV.

## 5. Non-functional requirements

**NFR-1 Tech stack (constraint)** — Frontend React, backend Python (FastAPI), payments Stripe, database MySQL. Local development runs with Docker Compose.

**NFR-2 Security**
- No card data stored or processed by our servers (Stripe Elements, PCI SAQ A scope).
- Stripe webhook signatures are verified; secret keys live only in environment variables.
- HTTPS in production; authentication with short-lived tokens or secure HTTP-only cookies.
- Input validated on the backend; protection against SQL injection (ORM), XSS and CSRF.

**NFR-3 Money and data correctness**
- Amounts are stored as integers in the smallest currency unit (e.g. satang), with a currency code.
- Order and payment records are never hard-deleted.
- Schema changes go through Alembic migrations.

**NFR-4 Usability**
- Storefront works on mobile phones (responsive, from 360px width).
- *Assumption:* UI languages are Thai and English.

**NFR-5 Performance and availability** *(targets to confirm)*
- Catalogue and cart pages respond in under 500 ms at the 95th percentile under normal load.
- Daily database backups.

**NFR-6 Quality**
- Backend has automated tests for order, inventory and payment logic.
- Lint and tests run in CI on every pull request.

## 6. Proposed data model (first cut)

| Table               | Key fields                                                                    |
| ------------------- | ----------------------------------------------------------------------------- |
| `users`             | id, email, password_hash, name, phone, role, created_at                      |
| `categories`        | id, name, slug, sort_order                                                    |
| `products`          | id, category_id, sku, name, description, price_minor, currency, stock_qty, is_active |
| `product_images`    | id, product_id, url, sort_order                                               |
| `orders`            | id, order_number, user_id, status, subtotal_minor, shipping_minor, total_minor, currency, contact + delivery fields, created_at |
| `order_items`       | id, order_id, product_id, product_name, unit_price_minor, quantity            |
| `order_status_history` | id, order_id, from_status, to_status, changed_by, note, created_at         |
| `payments`          | id, order_id, stripe_payment_intent_id, amount_minor, status, created_at      |
| `refunds`           | id, payment_id, stripe_refund_id, amount_minor, reason, created_by, created_at |
| `stripe_events`     | id (Stripe event id), type, processed_at                                      |
| `stock_adjustments` | id, product_id, delta, reason, created_by, created_at                         |

## 7. Open questions

1. **What is being ordered?** Retail goods shipped to customers, food/drinks for a restaurant or café, or B2B wholesale? This changes the order flow a lot.
2. **Delivery, pickup, or both?** If delivery: how are shipping fees calculated, and is there courier integration?
3. **Single shop or multiple branches / sellers?**
4. **Currency and tax:** THB only? Should prices include VAT 7%, and are tax invoices needed?
5. **Payment methods:** cards only, or also PromptPay (supported by Stripe in Thailand)?
6. **Guest checkout:** can people order without creating an account?
7. **Product options:** do products have variants (size, colour) or add-ons?
8. **Languages:** Thai and English, or one only?
9. **Notifications:** email only, or also LINE / SMS?
10. **Scale:** expected orders per day and number of staff users?
11. **Hosting:** where will production run (VPS, AWS, GCP, …), and is there a domain?
12. **Timeline:** target date for the first release, and which of the items above are truly MVP?

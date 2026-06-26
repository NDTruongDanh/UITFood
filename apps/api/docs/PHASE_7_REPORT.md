# Phase 7 - Extract Promotions and Payments (Implementation Report)

**Status:** Phase 7 runs as two sequential waves. **Wave 1 (Promotion) is
code-complete and verified** at the typecheck/unit/build level. **Wave 2
(Payment) is code-complete and verified** at the typecheck/unit level: service
ownership, TCP contracts, Gateway route ownership, VNPay callback routing,
outbox publishing, timeout ownership, and the Ordering remote TCP adapter are
implemented. Remaining owner actions are service infrastructure, Payment data
backfill/reconciliation, provider callback cutover, and staged flag rollout.
**Scope:** `apps/services/promotion`, `apps/services/payment`, `apps/gateway`,
`packages/contracts`, and `apps/api` Ordering integration.
**Date:** 2026-06-26
**Relates to:** [MICROSERVICES_MIGRATION_PLAN.md](./MICROSERVICES_MIGRATION_PLAN.md)
Phase 7.

---

## 1. Objective

Separate the financial workflows — Promotions, then Payments — into independently
deployable services with idempotent network contracts, replacing the in-process
ports and events Ordering currently relies on. The two waves cut over
sequentially so checkout coupling is removed one boundary at a time.

## 2. Wave 1 — Promotion Extraction (code-complete)

### 2.1 Resulting Topology

```text
Browser / Admin / Mobile
          |
          v
      Edge Gateway
       |       |
       |       +-- all unrelated routes ---------> legacy API
       |
       +-- /api/promotions/active  ------------> Promotion TCP RPC (anonymous)
       +-- /api/promotions/preview ------------> Promotion TCP RPC (auth)
       +-- /api/promotions/coupons/validate ---> Promotion TCP RPC (auth)

monolith Ordering BC
   PlaceOrderHandler / cancellation rollback
        |  PROMOTION_APPLICATION_PORT (remote TCP adapter)
        v
   Promotion service ----> Promotion PostgreSQL
        ^
        |  promotion.discount.preview / reserve / confirm / rollback
        |  promotion.list-active
```

Default flag preserves rollback:

- `PROMOTION_ROUTES_ENABLED=false`: Gateway proxies `/api/promotions/**` to the
  monolith, which still serves them from the in-place `promotion` module.

### 2.2 Shared Contracts

`packages/contracts/src/promotion-rpc.ts` adds `PROMOTION_RPC_PATTERNS` — five
versioned TCP patterns — plus zod request/response schemas and the stable error
envelope:

| Pattern | Purpose |
| --- | --- |
| `promotion.discount.preview.v1` | Read-only eligibility + discount preview |
| `promotion.discount.reserve.v1` | Atomically reserve a discount for a pending order |
| `promotion.reservation.confirm.v1` | Transition reservations to `confirmed` |
| `promotion.reservation.rollback.v1` | Roll back reservations + decrement counters |
| `promotion.list-active.v1` | Public active-promotion discovery (anonymous) |

Every lifecycle call carries `internalAuth` — a short-lived internal JWT with
`aud=promotion`. The gateway issues a user-scoped token for the public preview;
the monolith Ordering adapter issues a `service:api` token for
reserve/confirm/rollback. `listActivePromotions` is anonymous.

### 2.3 Private Promotion Service

New app: `apps/services/promotion`. A pre-existing unadapted copy of the media
service was found in the directory and replaced.

It includes:

- a Nest TCP listener for business RPC on `PROMOTION_TCP_PORT` (4041);
- management HTTP `/live` and `/ready` on `PROMOTION_MANAGEMENT_PORT` (4042);
- the owned Drizzle schema + migration `0000_cool_killmonger.sql` for
  `promotions`, `coupon_codes`, and `promotion_usages` (7 enums, the atomic
  usage-counter columns, and the unique `coupon_codes.code` + per-user usage
  indexes);
- the extracted `PromotionService` (preview / reserve / confirm / rollback +
  `listPublicActive`), the three repositories, the pure `PromotionPricingEngine`,
  and the stale-reservation cleanup task (`@Cron`, every minute);
- `PromotionRpcController` mapping the patterns to the service and verifying the
  `aud=promotion` token on every lifecycle call;
- an internal JWT verifier (`InternalAuthService.verifyPromotionToken`).

The service is request/response only — no RabbitMQ in this wave.

The admin and restaurant *management* surfaces (promotion CRUD, coupon
management) were intentionally left in the monolith because they depend on
Catalog's `RESTAURANT_ACCESS_PORT`; only the checkout lifecycle + public read
moved.

### 2.4 Gateway Route Ownership

Gateway gains `PromotionRoutesModule` (registered behind
`PROMOTION_ROUTES_ENABLED`) exposing three public routes mirroring the monolith
`PromotionPublicController`:

- `GET /api/promotions/active` (anonymous);
- `POST /api/promotions/preview` (session-guarded);
- `POST /api/promotions/coupons/validate` (session-guarded).

Reads pass through; the authenticated routes use `PromotionSessionGuard` and mint
a `aud=promotion` JWT carrying the customer id. CORS + JSON body parsing for the
promotion public routes are wired into `gateway.factory.ts`, and
`api-proxy.factory.ts` excludes the promotion prefix from the legacy proxy when
the flag is on.

### 2.5 Ordering Remote TCP Adapter

`apps/api/src/integration/promotion/` adds `PromotionApplicationAdapter`
implementing `IPromotionApplicationPort` over TCP, mirroring the existing
media/identity integration pattern. `order.module` and `order-lifecycle.module`
now import `PromotionClientModule` instead of `PromotionModule`, so
`PlaceOrderHandler` and the cancellation rollback handler are unchanged (same
`PROMOTION_APPLICATION_PORT` token).

Resilience parity is preserved:

- preview/reserve degrade to a no-discount result when the service is
  unavailable, so checkout is never blocked by Promotion;
- confirm/rollback are fire-and-forget — failures are logged, never thrown, so an
  already-committed order or a cancellation is never aborted;
- deterministic 4xx envelopes (bad payload / auth) are re-thrown as HTTP.

### 2.6 Verification Performed (Wave 1)

| Check | Result |
| --- | --- |
| Contracts typecheck + build | Pass |
| Promotion typecheck | Pass |
| Promotion unit tests | 2 suites, 41 tests pass |
| Promotion build (`dist/main.js` emitted) | Pass |
| Promotion migration generation | Pass; `0000_cool_killmonger.sql` |
| Gateway typecheck | Pass |
| API typecheck | Pass |
| API ordering (place-order) + architecture boundary specs | 32 tests pass |

The `module-boundaries` spec passing confirms Ordering no longer imports the
Promotion BC directly — it depends only on the integration adapter.

## 3. Wave 2 - Payment Extraction (code-complete)

### 3.1 Resulting Topology

```text
Browser / Mobile / VNPay
          |
          v
      Edge Gateway
       |       |
       |       +-- unrelated routes and payment cancellation --> legacy API
       |
       +-- /api/payments/my --------------------> Payment TCP RPC (auth)
       +-- /api/payments/vnpay/ipn -------------> Payment TCP RPC (anonymous)
       +-- /api/payments/vnpay/return ----------> Payment TCP RPC (anonymous)
       +-- /api/payments/vnpay/mobile-return ---> Payment TCP RPC (anonymous)

monolith Ordering BC
   PlaceOrderHandler / payment cancellation
        |  PAYMENT_INITIATION_PORT (remote TCP adapter when enabled)
        v
   Payment service ----> Payment PostgreSQL
        |
        +-- outbox_events ---> RabbitMQ ---> Ordering event bridge
        ^
        |  ordering.order-cancelled-after-payment.v1
```

Default flags preserve rollback:

- `PAYMENT_RPC_ENABLED=false`: Ordering imports the local monolith Payment
  module through `PaymentIntegrationModule`.
- `PAYMENT_ROUTES_ENABLED=false`: Gateway proxies Payment HTTP routes to the
  monolith.
- `LEGACY_PAYMENT_RUNTIME_ENABLED=true`: the monolith keeps the timeout task and
  refund handler until service cutover.

The VNPay cancellation route stays owned by Ordering because it mutates the order
and then calls the Payment port to mark the pending attempt failed.

### 3.2 Shared Contracts

`packages/contracts/src/payment-rpc.ts` adds `PAYMENT_RPC_PATTERNS` plus zod
request/response schemas and a stable error envelope.

| Pattern | Purpose |
| --- | --- |
| `payment.attempt.create.v1` | Create or return an existing active VNPay payment attempt for an order |
| `payment.attempt.fail.v1` | Mark a pending attempt failed after checkout rollback |
| `payment.attempt.cancel-pending.v1` | Customer-driven VNPay cancellation by order |
| `payment.ipn.process.v1` | Process VNPay IPN with raw query/signature preservation |
| `payment.return.resolve.v1` | Resolve browser return redirect |
| `payment.mobile-return.resolve.v1` | Resolve mobile deep-link return |
| `payment.transactions.my.v1` | Customer payment history |

Lifecycle calls carry an `aud=payment` internal JWT. VNPay IPN/return callbacks
remain anonymous because the provider signs the raw query; the service performs
the existing signature checks.

### 3.3 Private Payment Service

New app: `apps/services/payment`.

It includes:

- a Nest TCP listener for business RPC on `PAYMENT_TCP_PORT` (4051);
- management HTTP `/live` and `/ready` on `PAYMENT_MANAGEMENT_PORT` (4052);
- the owned Drizzle schema + generated migration for `payment_transactions`,
  `outbox_events`, and `inbox_messages`;
- the extracted Payment application services, VNPay service, transaction
  repository, IPN handler, timeout task, and refund handler;
- `PaymentRpcController` mapping the Payment TCP contracts to the application
  service and preserving deterministic HTTP-like error envelopes;
- local outbox relay publishing `payment.confirmed.v1` and `payment.failed.v1`
  with `producer='payment'`;
- inbox-deduped RabbitMQ consumer for
  `ordering.order-cancelled-after-payment.v1`.

Payment attempt creation is idempotent by `orderId`: a repeated request with the
same customer and amount returns the existing active attempt URL, while a
different customer/amount fails with a deterministic conflict instead of
creating a second charge.

Provider callback deduplication is preserved by the transaction state machine and
the unique VNPay provider transaction number before the IPN handler returns an
acknowledgement.

### 3.4 Gateway Route Ownership

Gateway gains `PaymentRoutesModule` behind `PAYMENT_ROUTES_ENABLED`, exposing:

- `GET /api/payments/my`;
- `GET /api/payments/vnpay/ipn`;
- `GET /api/payments/vnpay/return`;
- `GET /api/payments/vnpay/mobile-return`.

The proxy excludes only these Payment-owned routes when the flag is enabled.
`/api/payments/vnpay/orders/:orderId/cancel` continues to proxy to the monolith
Ordering controller.

### 3.5 Ordering Remote TCP Adapter

`apps/api/src/integration/payment/` adds `PaymentInitiationAdapter`
implementing `IPaymentInitiationPort` over TCP. `PaymentIntegrationModule`
selects the local `PaymentModule` or remote `PaymentClientModule` at startup via
`PAYMENT_RPC_ENABLED`, so `PlaceOrderHandler` and the cancellation controller
continue depending on the same port token.

Resilience parity is preserved:

- deterministic 4xx RPC envelopes are re-thrown as HTTP;
- create-attempt outages fail checkout predictably with `503`;
- mark-failed remains best-effort unless `PAYMENT_RPC_REQUIRED=true`.

### 3.6 Verification Performed (Wave 2)

| Check | Result |
| --- | --- |
| Contracts typecheck + build | Pass |
| API typecheck | Pass |
| Gateway typecheck | Pass |
| Payment service typecheck | Pass |
| Payment service migration generation | Pass |
| API focused Payment/Ordering tests | 4 suites, 54 tests pass |
| Payment service unit tests | 5 suites, 68 tests pass |

## 4. Cutover And Rollback

### Wave 1 - Promotion

#### Forward Cutover

1. Provision the Promotion Postgres + private service (flag off).
2. Run Promotion migrations.
3. Backfill `promotions`, `coupon_codes`, and `promotion_usages` from the
   monolith; reconcile counts.
4. Set `PROMOTION_RPC_REQUIRED=true` and verify Ordering reserve/confirm/rollback
   against the service.
5. Enable Gateway routes: `PROMOTION_ROUTES_ENABLED=true`.
6. Smoke active-promotion list, preview, coupon validation, and a full
   checkout + cancellation discount lifecycle.

#### Rollback

1. `PROMOTION_ROUTES_ENABLED=false` (Gateway resumes proxying to the monolith).
2. Point Ordering back at the local `PromotionModule` (revert the integration
   import) if the service must be removed from the checkout path.

Until cutover, promotion *management* writes still land in the monolith database
while the checkout lifecycle uses the service database — a deliberate strangler
split resolved by the backfill step.

### Wave 2 - Payment

#### Forward Cutover

1. Provision Payment Postgres, RabbitMQ bindings, and the private service (flags
   off).
2. Run the Payment service migration and backfill `payment_transactions`.
3. Reconcile successful VNPay provider transactions against orders and provider
   identifiers.
4. Point VNPay callback URLs at the Gateway path already exposed to clients.
5. Set `PAYMENT_RPC_ENABLED=true` and verify Ordering create-attempt /
   mark-failed / cancel-pending calls against the service.
6. Set `PAYMENT_ROUTES_ENABLED=true` so Gateway-owned VNPay callback and history
   routes call the Payment service directly.
7. After the service owns runtime work, set `LEGACY_PAYMENT_RUNTIME_ENABLED=false`
   in the monolith. Later set `LEGACY_PAYMENT_ROUTES_ENABLED=false` once route
   rollback is no longer needed.

#### Rollback

1. `PAYMENT_ROUTES_ENABLED=false` (Gateway resumes proxying Payment routes to the
   monolith).
2. `PAYMENT_RPC_ENABLED=false` (Ordering resumes using the local Payment module).
3. `LEGACY_PAYMENT_RUNTIME_ENABLED=true` if timeout/refund handling must return
   to the monolith during rollback.

## 5. Exit Criteria Status

| Phase 7 criterion | Status |
| --- | --- |
| A repeated checkout/payment request returns the original attempt rather than a second charge or reservation | Implemented — Promotion reservation is idempotent per `orderId`; Payment create-attempt returns the existing active VNPay attempt for the same order/customer/amount |
| An unavailable Promotion service fails checkout predictably or follows the approved no-discount policy | Implemented — adapter degrades to no-discount; checkout proceeds |
| A Payment outage leaves a recoverable saga checkpoint; no order silently marked paid/cancelled | Implemented in code — create-attempt fails checkout with `503`; mark-failed is best-effort unless `PAYMENT_RPC_REQUIRED=true`; timeout/IPN ownership moves to the service after cutover |
| Finance reconciliation reports no unmatched successful provider transactions | Owner action — requires production backfill and provider reconciliation during cutover |

## 6. Owner Actions

- Provision Promotion Postgres + private service; add the Compose/CI/Render infra
  for `apps/services/promotion` (not yet created — Promotion infra wiring is a
  follow-up, mirroring the catalog Step-7 work).
- Provision Payment Postgres + private service; add the Compose/CI/Render infra
  for `apps/services/payment`, including RabbitMQ bindings for outbox/inbox
  processing.
- Run the Promotion data backfill during a controlled window; reconcile counts.
- Flip `PROMOTION_RPC_REQUIRED` then `PROMOTION_ROUTES_ENABLED`; monitor RPC
  latency and reservation/confirm/rollback rates.
- Run the Payment data backfill and VNPay/provider reconciliation before
  enabling `PAYMENT_RPC_ENABLED` and `PAYMENT_ROUTES_ENABLED`.
- After Payment cutover, disable duplicate monolith runtime work with
  `LEGACY_PAYMENT_RUNTIME_ENABLED=false`.
- Later: migrate admin/restaurant promotion management out of the monolith once
  Catalog's restaurant-access RPC is available to the Promotion service.

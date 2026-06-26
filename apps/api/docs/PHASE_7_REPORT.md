# Phase 7 - Extract Promotions and Payments (Implementation Report)

**Status:** Phase 7 runs as two sequential waves. **Wave 1 (Promotion) is
code-complete and verified** at the typecheck/unit/build level — service
ownership, TCP contracts, Gateway route ownership, and the Ordering remote TCP
adapter are implemented. **Wave 2 (Payment) is not started** (surveyed only).
Remaining owner actions for Wave 1 are Promotion data backfill, the
`PROMOTION_ROUTES_ENABLED` / `PROMOTION_RPC_REQUIRED` cutover, and later
migration of the admin/restaurant promotion management surfaces.
**Scope:** `apps/services/promotion`, `apps/gateway`, `packages/contracts`,
`apps/api` Ordering integration, and the (pending) Payment extraction.
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

## 3. Wave 2 — Payment Extraction (not started)

Surveyed only; no files created and the monolith is unchanged. The intended
shape, from the migration plan:

- Define idempotent TCP patterns: create-attempt, mark-failed, refund, query.
- Route VNPay IPN / return / mobile-return HTTP through the Gateway and translate
  callbacks to Payment TCP patterns without altering provider-visible URLs,
  raw/query data, or signature verification.
- Persist provider callback deduplication before acknowledging an IPN.
- Publish payment result events from the Payment outbox; Ordering must no longer
  receive an in-process event.
- Migrate `payment_transactions`, reconcile against orders and provider
  identifiers, then switch route and adapter ownership.

Coupling surfaces identified in the monolith that the wave must address:

| Surface | Current state |
| --- | --- |
| Synchronous port | Ordering uses `IPaymentInitiationPort` (`initiateVNPayPayment`, `markPaymentAttemptFailed`) in `PlaceOrderHandler` + `PaymentCancellationController` → becomes a remote TCP adapter |
| Event path | Ordering consumes `payment.confirmed.v1` / `payment.failed.v1`; must come from the Payment outbox over RabbitMQ, not an in-process event |
| VNPay callbacks | `PaymentController` IPN/return/mobile-return + `ProcessIpnHandler` need raw-query signature verification preserved and callback dedup before IPN ack |
| Scheduled work | `PaymentTimeoutTask` (single-owner cron) moves to the service |

Contracts already define the result events (`payment.confirmed.v1`,
`payment.failed.v1`, `ordering.order-cancelled-after-payment.v1`).

## 4. Cutover And Rollback (Wave 1)

### Forward Cutover

1. Provision the Promotion Postgres + private service (flag off).
2. Run Promotion migrations.
3. Backfill `promotions`, `coupon_codes`, and `promotion_usages` from the
   monolith; reconcile counts.
4. Set `PROMOTION_RPC_REQUIRED=true` and verify Ordering reserve/confirm/rollback
   against the service.
5. Enable Gateway routes: `PROMOTION_ROUTES_ENABLED=true`.
6. Smoke active-promotion list, preview, coupon validation, and a full
   checkout + cancellation discount lifecycle.

### Rollback

1. `PROMOTION_ROUTES_ENABLED=false` (Gateway resumes proxying to the monolith).
2. Point Ordering back at the local `PromotionModule` (revert the integration
   import) if the service must be removed from the checkout path.

Until cutover, promotion *management* writes still land in the monolith database
while the checkout lifecycle uses the service database — a deliberate strangler
split resolved by the backfill step.

## 5. Exit Criteria Status

| Phase 7 criterion | Status |
| --- | --- |
| A repeated checkout/payment request returns the original attempt rather than a second charge or reservation | Promotion: reservation is idempotent per `orderId` with atomic counters; **Payment idempotency pending Wave 2** |
| An unavailable Promotion service fails checkout predictably or follows the approved no-discount policy | Implemented — adapter degrades to no-discount; checkout proceeds |
| A Payment outage leaves a recoverable saga checkpoint; no order silently marked paid/cancelled | **Pending Wave 2** |
| Finance reconciliation reports no unmatched successful provider transactions | **Pending Wave 2** |

## 6. Owner Actions

- Provision Promotion Postgres + private service; add the Compose/CI/Render infra
  for `apps/services/promotion` (not yet created — Promotion infra wiring is a
  follow-up, mirroring the catalog Step-7 work).
- Run the Promotion data backfill during a controlled window; reconcile counts.
- Flip `PROMOTION_RPC_REQUIRED` then `PROMOTION_ROUTES_ENABLED`; monitor RPC
  latency and reservation/confirm/rollback rates.
- Execute the Payment wave (Wave 2) and its cutover.
- Later: migrate admin/restaurant promotion management out of the monolith once
  Catalog's restaurant-access RPC is available to the Promotion service.

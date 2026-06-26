# Phase 8 - Extract Reviews (Implementation Report)

**Status:** Code-complete and verified at the typecheck/unit/component-test
level. Remaining owner actions are Review database provisioning, backfill,
event replay/reconciliation, and staged route cutover.
**Scope:** `apps/services/review`, `apps/gateway`, `packages/contracts`, and
`apps/api` transitional Ordering eligibility RPC.
**Date:** 2026-06-26
**Relates to:** [MICROSERVICES_MIGRATION_PLAN.md](./MICROSERVICES_MIGRATION_PLAN.md)
Phase 8.

---

## 1. Objective

Move Review ownership into an independently deployable service after the
cross-context transaction was removed. Review now owns review writes and
publishes `review.submitted.v1`; Ordering, Catalog, and Notification continue to
converge through event consumers instead of direct database access.

## 2. Resulting Topology

```text
Browser / Mobile
      |
      v
  Edge Gateway
   |       |
   |       +-- unrelated routes -------------> legacy API
   |
   +-- /api/reviews/** ---------------------> Review TCP RPC

Review service ----> Review PostgreSQL
      |
      +-- ordering.review-eligibility.get.v1 --> legacy API Ordering TCP
      |
      +-- outbox_events --> RabbitMQ --> Ordering/Catalog/Notification consumers
```

Default flags preserve rollback:

- `REVIEW_ROUTES_ENABLED=false`: Gateway proxies `/api/reviews/**` to the
  monolith Review controller.
- The monolith exposes only the transitional
  `ordering.review-eligibility.get.v1` read over `ORDERING_TCP_PORT` until
  Ordering is extracted in Phase 9.

## 3. Shared Contracts

`packages/contracts/src/review-rpc.ts` adds Review TCP patterns plus zod
request/response schemas and a stable RPC error envelope:

| Pattern                     | Purpose                               |
| --------------------------- | ------------------------------------- |
| `review.submit.v1`          | Customer review submission            |
| `review.restaurant.list.v1` | Public visible restaurant reviews     |
| `review.mine.get.v1`        | Customer-owned review lookup by order |

`packages/contracts/src/ordering-rpc.ts` adds:

| Pattern                              | Purpose                                               |
| ------------------------------------ | ----------------------------------------------------- |
| `ordering.review-eligibility.get.v1` | Read-only order ownership/status check used by Review |

Authenticated Review calls carry `internalAuth` with `aud=review`. The Review
service issues a short-lived service token with `aud=ordering` when checking
eligibility.

## 4. Private Review Service

New app: `apps/services/review`.

It includes:

- a Nest TCP listener for business RPC on `REVIEW_TCP_PORT` (4061);
- management HTTP `/live` and `/ready` on `REVIEW_MANAGEMENT_PORT` (4062);
- the owned Drizzle schema and migration for `reviews` plus `outbox_events`;
- the extracted Review command handler, repository, and service;
- an Ordering TCP adapter with a short timeout and no automatic retry;
- `ReviewRpcController` mapping public Review contracts to application code;
- internal JWT verification for user-scoped `aud=review` calls;
- transactional outbox relay publishing `review.submitted.v1` with
  `producer='review-service'`.

The unique `reviews.order_id` constraint remains the final one-review-per-order
defense. Duplicate pre-checks still return the richer `MSG-RATE-03` response,
and a concurrent unique violation is mapped back to a 409 conflict.

## 5. Gateway Route Ownership

Gateway gains `ReviewRoutesModule` behind `REVIEW_ROUTES_ENABLED`, exposing:

- `POST /api/reviews`;
- `GET /api/reviews/restaurant/:restaurantId`;
- `GET /api/reviews/my/:orderId`.

The authenticated routes use the gateway session authenticator and mint
`aud=review` tokens. The public restaurant listing remains anonymous. CORS and
JSON parsing are enabled only for Review-owned routes when the flag is on, and
the monolith proxy excludes `/api/reviews/**` only during cutover.

## 6. Legacy API Bridge

`apps/api` now exposes a narrow Ordering TCP controller for
`ordering.review-eligibility.get.v1`. It verifies service-scoped internal JWTs
with `aud=ordering` and delegates to the existing `ORDER_ELIGIBILITY_PORT`.

The monolith Review module no longer imports Catalog contracts. Review writes
still use the local outbox path while the route remains on the monolith for
rollback.

## 7. Verification Performed

| Check                                   | Result                |
| --------------------------------------- | --------------------- |
| Contracts typecheck + build             | Pass                  |
| Review service typecheck                | Pass                  |
| Gateway typecheck                       | Pass                  |
| API typecheck                           | Pass                  |
| Review service unit tests               | 1 suite, 3 tests pass |
| API Review regression test              | 1 suite, 3 tests pass |
| API architecture boundary tests         | 1 suite, 5 tests pass |
| Gateway Review route e2e/component test | 1 suite, 5 tests pass |

## 8. Cutover And Rollback

### Forward Cutover

1. Provision Review Postgres, RabbitMQ permissions, and the private Review
   service with `REVIEW_ROUTES_ENABLED=false`.
2. Run the Review migration and backfill `reviews` from the monolith at a
   recorded watermark.
3. Replay or export Review events so Catalog rating aggregates and Ordering
   reviewed markers match the source.
4. Verify one-review-per-order counts, public listing counts, rating aggregates,
   and reviewed markers.
5. Enable `REVIEW_ROUTES_ENABLED=true` in the gateway.
6. Smoke submit, duplicate submit, restaurant listing, and my-review lookup.

### Rollback

1. Set `REVIEW_ROUTES_ENABLED=false` so the gateway resumes proxying Review
   routes to the monolith.
2. Stop Review service writers/outbox relay before re-enabling legacy authority.
3. Roll back only while legacy Review data is still synchronized from Review
   service events or the approved reverse-sync mechanism.

## 9. Exit Criteria Status

| Phase 8 criterion                                                   | Status                                                                                                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| The unique order-to-review invariant holds under concurrency        | Implemented in code by the `reviews.order_id` unique constraint and 23505-to-409 mapping; production proof requires cutover concurrency rehearsal |
| Rating and reviewed-marker projections converge and can be replayed | Implemented through durable `review.submitted.v1` outbox events and existing Ordering/Catalog consumers; replay/backfill remains an owner action  |
| Review has no access to Ordering or Catalog databases               | Implemented for the extracted service; it uses Ordering TCP eligibility and publishes events                                                      |

## 10. Owner Actions

- Provision Review Postgres and RabbitMQ permissions.
- Backfill `reviews` and reconcile counts/checksums.
- Rebuild Catalog rating aggregates and Ordering reviewed markers from Review
  events or a controlled export.
- Enable `REVIEW_ROUTES_ENABLED=true` after reconciliation passes.
- Monitor Review RPC latency, outbox age, event lag, DLQ count, duplicate-review
  conflicts, and rating/reviewed-marker divergence.

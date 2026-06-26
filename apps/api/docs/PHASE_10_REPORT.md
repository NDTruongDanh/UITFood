# Phase 10 - Reporting migration and monolith retirement (Implementation Report)

**Status:** The Reporting extraction is **code-complete and verified** at the
typecheck/unit/build level. Reporting is the ninth and final business context to
leave the monolith. The actual deletion of the `apps/api` monolith modules and
the removal of the Edge Gateway fallback proxy are **strictly post-deployment
owner actions** — see §4 — and are intentionally NOT performed in code.
**Scope:** `apps/services/reporting`, `apps/gateway`, `packages/contracts`, and
`apps/api` (read-only source for the move).
**Date:** 2026-06-26
**Relates to:** [MICROSERVICES_MIGRATION_PLAN.md](./MICROSERVICES_MIGRATION_PLAN.md)
Phase 10.

---

## 1. Objective

Replace the monolith's last feature — `admin-analytics`, which deliberately
violated database ownership by running cross-context SQL joins over Ordering and
Catalog tables — with an independent, event-fed Reporting service. Once every
service is cut over in production, this closes the strangler migration and the
legacy monolith runtime can be retired.

## 2. Resulting Topology

```text
Browser / Admin
      |
      v
  Edge Gateway
   |       |
   |       +-- all other routes ------------------> (owned by 8 services /
   |                                                  monolith fallback pre-cutover)
   |
   +-- /api/admin/analytics/** -------------------> Reporting TCP RPC

Reporting service
   |                                   ^
   +-- Reporting PostgreSQL            |  reporting.analytics.platform.v1
       (projection tables only)        |
   ^
   |  RabbitMQ topic exchange
   +-- ordering.order.placed.v1        --> OrderProjectionConsumer
   +-- ordering.order-status.changed.v1 -->  (order + order-item facts)
   +-- catalog.restaurant.changed.v1   --> RestaurantProjectionConsumer
                                              (restaurant facts)
```

Default flag preserves rollback:

- `REPORTING_ROUTES_ENABLED=false`: Gateway proxies `/api/admin/analytics/**` to
  the monolith, which still serves it from the in-place `admin-analytics` module.

## 3. Implementation

### 3.1 Private Reporting Service

New app: `apps/services/reporting` (hybrid TCP + management HTTP, ports
**4081 / 4082**, dedicated Postgres). Reporting owns **no business tables** — only
read-optimized projection tables it maintains from domain events. It is a pure
event consumer (it publishes nothing), so the messaging runtime is inbound only
(RabbitMQ consumer + inbox deduplicator; no outbox/relay).

### 3.2 The Critical Architecture Rule — No Cross-Service Joins

The monolith repository joined `orders`, `order_items`, `order_status_logs`
(Ordering) and `restaurants` (Catalog). Reporting cannot do that. It instead
maintains its own fact tables (migration `0000_tired_loki.sql`):

| Projection table | Fed by | Purpose |
| --- | --- | --- |
| `reporting_order_facts` | `ordering.order.placed.v1`, `ordering.order-status.changed.v1` | One row per order: amounts, status, district, placedAt, and stamped `confirmedAt`/`readyAt` |
| `reporting_order_item_facts` | `ordering.order.placed.v1` (items) | One row per order line for the top-items report |
| `reporting_restaurant_facts` | `catalog.restaurant.changed.v1` | Denormalized approved/open status for the online/offline/pending counts |

Two consumers maintain them, each idempotent through the inbox (dedupe insert +
business write in one transaction) and `ON CONFLICT` upserts, so replayed or
reordered deliveries converge:

- `OrderProjectionConsumer` — upserts the order fact + inserts item facts on
  placed; updates status and stamps `confirmedAt`/`readyAt` on status changes. A
  status event arriving before its placed event creates a placeholder that the
  later placed event fills without clobbering the status.
- `RestaurantProjectionConsumer` — upserts restaurant status.

The `AdminAnalyticsRepository` was rewritten to query **only these projection
tables**. The prep-time metric reads the stamped `confirmedAt`/`readyAt` columns
instead of the monolith's `order_status_logs` self-join. Any join that remains
(e.g. order facts ⋈ order-item facts) is **intra-service** — within Reporting's
own database — which the no-cross-service-JOIN rule permits. Item revenue is
`unitPrice × quantity` (the event carries no per-line modifier total), an
accepted projection approximation noted in the schema.

### 3.3 Shared Contracts and Gateway

`packages/contracts/src/reporting-rpc.ts` adds `REPORTING_RPC_PATTERNS`
(`reporting.analytics.platform.v1`) + the request/error schemas. The
`ReportingRpcController` verifies the `aud=reporting` token and re-checks the
admin role. `apps/gateway/src/reporting/` adds `ReportingRoutesModule` (behind
`REPORTING_ROUTES_ENABLED`) exposing `GET /api/admin/analytics/platform`,
session-guarded and translated to TCP — mirroring the monolith
`AdminAnalyticsController`. CORS + JSON parsing and the
`isReportingPublicRoute` proxy exclusion are wired into the gateway.

## 4. Monolith Retirement — Post-Deployment Owner Actions (NOT done in code)

This phase deliberately does **not** delete monolith modules or remove the
gateway fallback proxy. Doing so in code would force a big-bang release — all
eight services would have to be provisioned, backfilled, and flag-enabled
simultaneously — which defeats the strangler pattern and the per-service cutover
flags that the whole migration was built around.

On-disk reality at the close of Phase 10: `apps/api` still contains **25 active
`@Controller`s and 5 RabbitMQ consumers** across all nine contexts (every prior
phase copied modules into services but deferred deletion to cutover). They are
**required** to keep serving traffic until each service's live database is
backfilled and its cutover flag is enabled in production.

The following are strictly post-deployment owner actions, performed **per
service** and only after **all eight services have been successfully cut over in
production and observed for 14 days**:

1. For each service, provision + backfill its production database (and Redis /
   pgvector where applicable), enable its `*_ROUTES_ENABLED` (and any
   `*_RPC_REQUIRED`) flag, and disable the corresponding legacy flag.
2. After all services are cut over and stable for 14 days, delete the
   now-superseded business modules from `apps/api/src/module/**` and their
   RabbitMQ consumers, and strip the monolith's HTTP/microservice bootstrap.
3. Only then remove the Edge Gateway fallback proxy in
   `apps/gateway/src/gateway.factory.ts` (keeping the Socket.IO upgrade routed to
   the Notification service), force every gateway route flag on, and update the
   gateway proxy/health E2E suites to assert the no-fallback contract.
4. Decommission the legacy `apps/api` runtime.

Until step 3, the fallback proxy is load-bearing: routes whose cutover flag is
still off are served by the monolith through it.

## 5. Verification Performed

| Check | Result |
| --- | --- |
| Contracts typecheck + build | Pass |
| Reporting typecheck | Pass |
| Reporting migration generation | Pass; `0000_tired_loki.sql` (4 tables) |
| Gateway typecheck | Pass |
| Workspace typecheck (`turbo run typecheck`) | 16/16 packages pass |
| Workspace tests (`turbo run test`) | 15/15 tasks pass (api 677, ordering 135, catalog 69, notification 185, …) |
| Existing gateway proxy/health E2E | Unchanged and passing (fallback intentionally left in place) |

## 6. Exit Criteria Status

| Phase 10 criterion | Status |
| --- | --- |
| Admin analytics served from an event-fed Reporting service with no cross-context joins | Implemented — projection tables + two idempotent consumers; repository queries only Reporting's own DB |
| Reporting rebuildable from the event stream | Implemented via idempotent inbox + `ON CONFLICT` upserts; an empty-DB replay drill remains an owner action |
| Monolith runtime retired | Pending — strictly the post-deployment owner actions in §4 |

## 7. Owner Actions

- Add the Reporting Compose/CI/Render infra (Postgres + private service),
  mirroring the catalog Step-7 wiring; add `RENDER_REPORTING_DEPLOY_HOOK`.
- Bootstrap the Reporting projections in production (replay the order/restaurant
  event history, or backfill the fact tables, then let the consumers tail live).
- Flip `REPORTING_ROUTES_ENABLED`; verify the admin dashboard against the
  projections; monitor consumer lag on `reporting.ordering-events.v1` and
  `reporting.catalog-events.v1`.
- Execute the §4 monolith-retirement sequence after all eight services are cut
  over and observed stable for 14 days.

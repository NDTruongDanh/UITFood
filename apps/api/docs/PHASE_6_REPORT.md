# Phase 6 - Extract Restaurant Catalog (Implementation Report)

**Status:** Code boundaries, Catalog service ownership, Gateway route ownership,
durable change-event publication, inbound rating projection, monolith Ordering
snapshot bridge, local Compose, CI/CD, and Render private service/Postgres
configuration are implemented and verified at the typecheck/unit/build level.
Remaining owner actions are live Catalog data backfill, service/Gateway E2E,
Render apply, staging drills, the `CATALOG_ROUTES_ENABLED` cutover, and deletion
of the monolith `restaurant-catalog` module.
**Scope:** `apps/services/catalog`, `apps/gateway`, `packages/contracts`,
`apps/api` Ordering snapshot bridge, local Compose, CI/CD, and Render Terraform.
**Date:** 2026-06-26
**Relates to:** [MICROSERVICES_MIGRATION_PLAN.md](./MICROSERVICES_MIGRATION_PLAN.md)
Phase 6.

---

## 1. Objective

Extract the Restaurant Catalog bounded context — the platform's densest
read/write domain — into a standalone service while keeping the monolith's
Ordering module operational through event-driven snapshots rather than shared
tables or synchronous calls.

Phase 6 moves ownership of:

- restaurants, approval state, and logo/cover media references;
- menu categories, menu items, and sold-out state;
- modifier groups and options;
- delivery zones and delivery estimation;
- nutrition facts, analysis, and calculation;
- dietary tags;
- keyword search and the pgvector AI-search index (embeddings, ranking, HNSW).

## 2. Resulting Topology

```text
Browser / Admin / Mobile
          |
          v
      Edge Gateway
       |       |
       |       +-- all unrelated routes ---------> legacy API
       |
       +-- /api/restaurants/** -----------------> Catalog TCP RPC
       +-- /api/menu-items/** ------------------> Catalog TCP RPC
       +-- /api/restaurant/menu-items/:id/nutrition --> Catalog TCP RPC
       +-- /api/search/** ----------------------> Catalog TCP RPC
       +-- /api/dietary-tags/** ----------------> Catalog TCP RPC

Catalog service
   |        |          |
   |        |          +-- Media TCP RPC (image metadata + signing)
   |        +------------- Identity TCP RPC (owner role on approval)
   +-------------------- Catalog PostgreSQL (pgvector + trgm + unaccent)

RabbitMQ topic exchange
   ^                                   |
   |                                   v
   +-- catalog.restaurant.changed.v1   catalog.review-events.v1 queue
   +-- catalog.menu-item.changed.v1        ^
   +-- catalog.delivery-zone.changed.v1    |
            |                          review.submitted.v1
            v
   monolith Ordering ACL (EventBusBridgeConsumer -> snapshot projectors)
```

Default flag preserves rollback:

- `CATALOG_ROUTES_ENABLED=false`: Gateway proxies catalog HTTP routes to the
  monolith, which still serves them from the in-place `restaurant-catalog`
  module. Cutover flips the flag; the monolith module is deleted only after the
  flag has been stable in production.

## 3. Implementation

### 3.1 Shared Contracts

`packages/contracts/src/catalog-rpc.ts` adds `CATALOG_RPC_PATTERNS` — 44
versioned TCP message patterns spanning restaurants, menu categories/items,
modifier groups/options, delivery zones + estimation, search, AI search,
nutrition, and dietary tags — plus the `catalogRpcErrorSchema` envelope and the
internal-caller shape. The three Catalog change events were already declared in
`packages/contracts/src/event-names.ts`:

| Event | Purpose |
| --- | --- |
| `catalog.restaurant.changed.v1` | Restaurant create/update/approval/open-state |
| `catalog.menu-item.changed.v1` | Menu item create/update/sold-out/remove |
| `catalog.delivery-zone.changed.v1` | Delivery zone upsert + tombstone |

Mutating RPC calls require the Gateway-issued internal JWT scoped to
`aud=catalog`.

### 3.2 Private Catalog Service

New app: `apps/services/catalog`.

It includes:

- Nest TCP listener for business RPC on `CATALOG_TCP_PORT` (4031), split across
  7 `@MessagePattern` controllers (restaurant, zones, menu, modifiers,
  dietary-tags, search, nutrition);
- Management HTTP `/live` and `/ready` on `CATALOG_MANAGEMENT_PORT` (4032);
- Owned Drizzle schema and a single `0000_init_catalog.sql` migration covering
  18 tables, the `vector`/`unaccent`/`pg_trgm` extensions, and the HNSW + GIN
  (tsvector/trgm) search indexes for restaurants and menu items;
- The extracted restaurant, menu, modifier, zone, nutrition, dietary-tag, and
  AI-search domain services and repositories;
- An Ollama AI provider and embedding-indexing write path behind
  `AI_SEARCH_*` flags (disabled by default);
- The transactional outbox writer + relay for change-event publication;
- An internal JWT verifier (`InternalAuthService.verifyCatalogToken`) that
  accepts only `aud=catalog` tokens from trusted issuers.

Identity and Media are reached over internal TCP RPC adapters
(`integration/identity`, `integration/media`); the service signs its own
internal JWT (`iss=uitfood-catalog`) for those calls. Both RPC dependencies are
optional by default (`*_RPC_REQUIRED=false`) so Catalog boots and serves reads
even if a downstream service is briefly unavailable.

### 3.3 Durable Event Flow

**Outbound.** Catalog writes change events to its outbox inside the same
transaction as the domain mutation; the relay publishes them to the topic
exchange with publisher confirms.

**Inbound.** `ReviewRatingConsumer` subscribes to queue
`catalog.review-events.v1` (consumer `catalog.review-projection`) on routing key
`review.submitted.v1` and projects rating aggregates onto restaurants, using the
inbox table for at-least-once dedupe.

### 3.4 Monolith Ordering Snapshot Bridge

Ordering keeps its own read-model snapshots of restaurants, menu items, and
delivery zones; it never joins Catalog tables. The Phase-2
`EventBusBridgeConsumer` in the monolith subscribes to the three
`catalog.*.changed.v1` routing keys, dedupes through the inbox, and re-emits
them as in-process Nest CQRS events (`RestaurantUpdatedEvent`,
`MenuItemUpdatedEvent`, `DeliveryZoneSnapshotUpdatedEvent`). The existing
idempotent Ordering projectors (`ON CONFLICT DO UPDATE`) consume those. A
verification spec
(`apps/api/src/messaging/consumers/eventbus-bridge.consumer.spec.ts`) pins this
contract end to end.

### 3.5 Gateway Route Ownership

Gateway gains `CatalogRoutesModule` (registered behind `CATALOG_ROUTES_ENABLED`)
with 7 controllers exposing 45 HTTP routes:

- `GET/POST/PATCH/DELETE /api/restaurants/**` (incl. approval + logo/cover);
- `/api/restaurants/:restaurantId/delivery-zones/**` + estimate;
- `/api/menu-items/**` (incl. image, sold-out toggle);
- `/api/menu-items/:menuItemId/modifier-groups/**` + options;
- `/api/restaurant/menu-items/:menuItemId/nutrition/**`;
- `/api/search/**` (keyword + AI);
- `/api/dietary-tags/**`.

Reads pass straight through to `catalog.send()`. Mutations are guarded by
`CatalogSessionGuard`, which validates the external session and signs an
internal JWT with `aud=catalog` before the TCP call. CORS and JSON body parsing
for the catalog public routes are wired into `gateway.factory.ts`, and
`api-proxy.factory.ts` excludes the catalog public prefixes from the legacy
proxy when the flag is on.

### 3.6 Local Dev, CI, And Render

Local Compose now provisions the `catalog` service with its own
`uitfood_catalog` database credential, RabbitMQ access, Media/Identity TCP
connections, internal-auth secret, and `AI_SEARCH_*` defaults; the Gateway block
gains `CATALOG_ROUTES_ENABLED=true` and `CATALOG_TCP_HOST/PORT`.
`infra/postgres/init-test-db.sql` adds the `uitfood_catalog` role + database
(legacy API credential denied) and installs `vector`/`unaccent`/`pg_trgm` inside
it.

CI adds `.github/workflows/pipeline-catalog.yml`:

- lint and typecheck;
- unit tests;
- build;
- migration validation against a **pgvector** Postgres service container plus
  RabbitMQ;
- TCP + Postgres E2E;
- Docker image publish;
- Render deploy hook (`RENDER_CATALOG_DEPLOY_HOOK`).

Render Terraform adds `render_postgres.catalog` (pgvector), the
`render_private_service.catalog`, catalog env locals, Gateway `CATALOG_*`
variables, ports (10004/10005), the `catalog_routes_enabled` cutover variable,
and outputs. The image tag is supplied from the Terraform Cloud workspace, the
same pattern Notification uses.

## 4. Cutover And Rollback Procedure

### Forward Cutover

1. Apply Render Terraform to provision Catalog Postgres (pgvector) and the
   private Catalog service with `catalog_routes_enabled=false`.
2. Run Catalog migrations.
3. Backfill the Catalog database from the monolith and let the outbox relay +
   Ordering snapshot bridge reach steady state (Ordering snapshots track Catalog
   live).
4. Verify row counts and a sample of restaurant/menu reads through the Catalog
   TCP RPC.
5. Enable Gateway Catalog routes: `CATALOG_ROUTES_ENABLED=true`.
6. Smoke restaurant list/detail, menu CRUD, modifiers, delivery estimate,
   nutrition, keyword search, AI search, and dietary tags through the Gateway.
7. Confirm Ordering still places orders using its snapshots while reads are
   served by Catalog.
8. After the flag is stable, **delete** the monolith `restaurant-catalog`
   module.

### Rollback

1. Disable Gateway Catalog routes: `CATALOG_ROUTES_ENABLED=false` (Gateway
   resumes proxying to the still-present monolith module).
2. Investigate; the monolith remains authoritative until the module is deleted.

Do not run both the monolith catalog write path and the extracted Catalog write
path against live traffic simultaneously after the flag flips; the Gateway flag
is the single switch.

## 5. Verification Performed

| Check | Result |
| --- | --- |
| Contracts typecheck + build | Pass |
| Catalog lint + typecheck | Pass |
| Catalog unit tests | 11 suites, 69 tests pass (incl. `internal-auth.service.spec.ts`) |
| Catalog build (`dist/main.js` emitted) | Pass |
| Catalog migration generation | Pass; `0000_init_catalog.sql` |
| Gateway typecheck + build | Pass |
| Gateway E2E | 15 tests pass |
| API Ordering snapshot bridge spec | 5 tests pass |
| API full suite | 675 tests pass |

A stale local `tsconfig.tsbuildinfo` initially suppressed `nest build` emit
(the `incremental` footgun previously seen on Gateway); cleared by deleting the
file and `dist`. CI and `turbo prune`-based Docker builds start from a clean
checkout and are unaffected.

## 6. Exit Criteria Status

| Phase 6 criterion | Status |
| --- | --- |
| Catalog reads/writes served by the extracted service behind a Gateway flag | Implemented; 44 RPC patterns, 45 Gateway routes, `CATALOG_ROUTES_ENABLED` |
| Ordering remains independent of Catalog tables/synchronous calls | Implemented via `catalog.*.changed.v1` → EventBusBridge → idempotent snapshot projectors; verified by spec |
| Catalog owns its database, including pgvector search structures | Implemented; dedicated `uitfood_catalog` DB/credential + extensions + HNSW/GIN indexes |
| Inbound review ratings projected without shared schema | Implemented via `catalog.review-events.v1` consumer with inbox dedupe |

## 7. Owner Actions

- Apply Render Terraform to provision Catalog Postgres (pgvector) and the
  private Catalog service in production.
- Add `RENDER_CATALOG_DEPLOY_HOOK` and set `catalog_image_tag` in the Terraform
  Cloud workspace.
- Configure `OLLAMA_*` / `AI_SEARCH_*` credentials in the Catalog secret group
  only if semantic search is enabled in production.
- Run the Catalog data backfill during a controlled window and verify Ordering
  snapshots converge.
- Run service + Gateway E2E for catalog reads, mutations, search, and AI search.
- Flip `CATALOG_ROUTES_ENABLED=true`, monitor RPC latency, the
  `catalog.review-events.v1` queue depth, and the outbox relay lag.
- After the flag is stable, delete the monolith `restaurant-catalog` module and
  its now-unused snapshot source tables.

# Phase 5 - Extract Notifications (Implementation Report)

**Status:** Code boundaries, Notification service ownership, Gateway route
ownership, durable event consumers, migration/backfill tooling, local Compose,
CI/CD, Render private service/Postgres/Key Value configuration, and cutover
flags are implemented and verified at the typecheck/unit/component/build level.
Remaining owner actions are live Notification data backfill, real SMTP/FCM and
WebSocket reconnect E2E tests, Render apply, staging outage drills, and
production cutover.
**Scope:** `apps/services/notification`, `apps/gateway`, legacy Notification
controls in `apps/api`, `packages/contracts`, local Compose, CI/CD, and Render
Terraform.
**Date:** 2026-06-25
**Relates to:** [MICROSERVICES_MIGRATION_PLAN.md](./MICROSERVICES_MIGRATION_PLAN.md)
Phase 5.

---

## 1. Objective

Extract Notifications to prove asynchronous service isolation and independent
WebSocket operation while preserving the public `/api/notifications/**` HTTP
contract and the public Socket.IO path.

Phase 5 moves ownership of:

- notification inbox persistence;
- preferences and denormalized contact email projection;
- device tokens;
- delivery logs;
- templates;
- in-app, email, and push delivery;
- Socket.IO notification delivery;
- Notification Redis state;
- Ordering, Payment, Review, Catalog, and Identity event consumption.

## 2. Resulting Topology

```text
Browser / Admin / Mobile
          |
          v
      Edge Gateway
       |       |
       |       +-- all unrelated routes --> legacy API
       |
       +-- /api/notifications/** -------> Notification TCP RPC
       |
       +-- /socket.io/** upgrade -------> Notification HTTP/Socket.IO

RabbitMQ topic exchange
       |
       +-- notification.domain-events.v1 quorum queue
               |
               v
        Notification service
          |       |        |
          |       |        +-- SMTP / FCM providers
          |       +----------- Notification Redis
          +------------------- Notification PostgreSQL
```

Default flags preserve rollback:

- `NOTIFICATION_ROUTES_ENABLED=false`: Gateway proxies notification HTTP routes
  to the monolith.
- `LEGACY_NOTIFICATION_ROUTES_ENABLED=true`: monolith notification HTTP routes
  remain available before cutover.
- `LEGACY_NOTIFICATION_RUNTIME_ENABLED=true`: monolith notification event
  handlers, Socket.IO gateway, and cleanup task remain active before cutover.

During local Compose cutover these are flipped so Gateway and the extracted
service own the Notification surface and the monolith runtime is disabled.

## 3. Implementation

### 3.1 Shared Contracts

`packages/contracts/src/notification.ts` adds versioned Zod contracts for:

| Pattern | Purpose |
| --- | --- |
| `notification.inbox.list.v1` | Paginated current-user inbox read |
| `notification.inbox.unread-count.v1` | Cached unread badge count |
| `notification.inbox.mark-read.v1` | Mark one notification as read |
| `notification.inbox.mark-all-read.v1` | Mark all current-user notifications as read |
| `notification.preferences.get.v1` | Read delivery preferences |
| `notification.preferences.update.v1` | Update delivery preferences |
| `notification.push-token.list.v1` | List registered push tokens |
| `notification.push-token.register.v1` | Register or refresh one push token |
| `notification.push-token.remove.v1` | Deactivate one push token |
| `notification.test.push.v1` | Development push test |
| `notification.test.email.v1` | Development email test |

Protected RPC calls require the Gateway-issued internal JWT. Development test
endpoints remain environment-gated at the Gateway.

### 3.2 Private Notification Service

New app: `apps/services/notification`.

It includes:

- Nest TCP listener for business RPC on `NOTIFICATION_TCP_PORT`.
- Management HTTP `/live` and `/ready` on `MANAGEMENT_PORT`.
- Owned Drizzle schema and migration for:
  - `notifications`
  - `notification_preferences`
  - `notification_delivery_logs`
  - `device_tokens`
  - `notification_restaurant_snapshots`
  - `inbox_messages`
- Extracted templates and channel services for in-app, email, and push.
- Dynamic SMTP binding: Nodemailer when configured, noop provider otherwise.
- Dynamic push binding: Firebase when `FIREBASE_SERVICE_ACCOUNT_PATH` is set,
  stub provider otherwise.
- Device token cleanup scheduled task in the extracted service.
- Notification-owned Redis/Key Value configuration for unread counts and
  presence state.
- Internal JWT verifier for Gateway-to-Notification RPC.
- Identity TCP directory client used for session-backed Socket.IO connection
  authentication and transitional contact lookup.

The service no longer contains the copied monolith controller, CQRS handlers,
or legacy Better Auth Socket.IO gateway. Domain events enter through durable
RabbitMQ consumers instead of in-process Nest events.

### 3.3 Durable Event Consumption

`NotificationEventConsumer` subscribes to queue
`notification.domain-events.v1` with consumer name `notification.domain-events`.

Routing keys:

- `ordering.order.placed.v1`
- `ordering.order-status.changed.v1`
- `ordering.order-cancelled-after-payment.v1`
- `payment.confirmed.v1`
- `payment.failed.v1`
- `review.submitted.v1`
- `catalog.restaurant.changed.v1`
- `identity.user-contact.changed.v1`
- `identity.user-role.changed.v1`

Consumer behavior:

- uses `inbox_messages` for at-least-once dedupe;
- updates restaurant snapshots from Catalog events;
- updates `notification_preferences.email` from Identity contact events;
- maps Ordering, Payment, and Review events to existing notification templates;
- keeps channel delivery fire-and-forget so SMTP/FCM outages do not fail the
  originating order or payment event;
- nacks unexpected handler failures so RabbitMQ can redeliver/backlog.

### 3.4 Gateway Route And Socket Ownership

Gateway now has `NotificationRoutesModule` for:

- `GET /api/notifications/my`
- `GET /api/notifications/my/unread-count`
- `PATCH /api/notifications/my/read-all`
- `PATCH /api/notifications/:id/read`
- `GET /api/notifications/my/preferences`
- `PATCH /api/notifications/my/preferences`
- `GET /api/notifications/my/push-tokens`
- `POST /api/notifications/my/push-tokens`
- `DELETE /api/notifications/my/push-tokens`
- `POST /api/notifications/test/push`
- `POST /api/notifications/test/email`

The Gateway validates the external session, signs an internal JWT with
`aud=notification`, and sends the request over Notification TCP RPC.

Socket.IO is not tunneled through TCP. When Notification route ownership is
enabled, Gateway proxies `/socket.io/**` upgrades to the Notification
management HTTP target so the Notification service owns the long-lived
namespace connection.

### 3.5 Backfill, Cutover, And Rollback Tooling

`apps/services/notification/scripts/sync-notifications.ts` supports:

- `source-to-target` backfill/catch-up;
- `target-to-source` rollback synchronization;
- UUID-preserving upserts;
- bounded primary-key batches;
- deterministic row-count and SHA-256 verification;
- optional contact projection seeding from Better Auth `user.email` into
  `notification_preferences.email` with
  `NOTIFICATION_SYNC_CONTACT_PROJECTION=true`;
- verify-only mode and a non-zero exit when the selected match scope differs.

The direct table sync verifies all Notification-owned tables. When optional
contact seeding is enabled, `notification_preferences` is excluded from the
exact match scope because it intentionally gains projected contact rows.

### 3.6 Monolith Cutover Controls

The legacy API now has two independent flags:

- `LEGACY_NOTIFICATION_ROUTES_ENABLED`
- `LEGACY_NOTIFICATION_RUNTIME_ENABLED`

When runtime is disabled, the monolith stops registering:

- notification CQRS event handlers;
- restaurant snapshot projector;
- device token cleanup task;
- legacy Socket.IO gateway.

When route ownership is disabled, the monolith notification controller returns
404 through `LegacyNotificationRouteGuard`. This lets cutover fail closed while
Gateway/Notification ownership is being switched.

### 3.7 Local Dev, CI, And Render

Local Compose now provisions the private Notification service with its own
database credential, dedicated `notification-redis` instance, RabbitMQ access,
Identity TCP connection, SMTP/FCM environment, and Gateway route flags.

CI now includes `.github/workflows/pipeline-notification.yml` for:

- lint and typecheck;
- build;
- migration validation against Postgres;
- Docker image publish;
- Render deploy hook.

Render Terraform now includes Notification private service, Notification
Postgres, Notification Key Value, Gateway route variables, legacy API cutover
flags, image tag variables, and outputs.

## 4. Cutover And Rollback Procedure

### Forward Cutover

1. Apply Render Terraform to provision Notification Postgres, Notification Key
   Value, private service, RabbitMQ bindings, SMTP credentials, FCM credentials,
   and deploy hook.
2. Run Notification migrations.
3. Run direct backfill:
   `SOURCE_DATABASE_URL=<api-db> TARGET_DATABASE_URL=<notification-db> pnpm --filter notification run db:sync`.
4. Require counts and hashes to match for the direct table sync.
5. Run contact projection seed if needed:
   `NOTIFICATION_SYNC_CONTACT_PROJECTION=true SOURCE_DATABASE_URL=<identity-or-api-db> TARGET_DATABASE_URL=<notification-db> pnpm --filter notification run db:sync`.
6. Disable monolith Notification runtime:
   `LEGACY_NOTIFICATION_RUNTIME_ENABLED=false`.
7. Enable Gateway Notification routes and Socket.IO proxying:
   `NOTIFICATION_ROUTES_ENABLED=true`.
8. Disable monolith Notification HTTP routes:
   `LEGACY_NOTIFICATION_ROUTES_ENABLED=false`.
9. Smoke inbox reads, unread counts, mark-read, preferences, push tokens,
   Socket.IO reconnect, SMTP, FCM, and RabbitMQ backlog drain.

### Rollback

1. Disable Gateway Notification routes:
   `NOTIFICATION_ROUTES_ENABLED=false`.
2. Keep monolith routes disabled until reverse sync completes.
3. Run reverse synchronization:
   `NOTIFICATION_SYNC_DIRECTION=target-to-source SOURCE_DATABASE_URL=<api-db> TARGET_DATABASE_URL=<notification-db> pnpm --filter notification run db:sync`.
4. Re-enable monolith runtime and routes:
   `LEGACY_NOTIFICATION_RUNTIME_ENABLED=true`,
   `LEGACY_NOTIFICATION_ROUTES_ENABLED=true`.
5. Verify clients reconnect to the monolith Socket.IO gateway and that unread
   counts match after reverse sync.

Do not enable both monolith and extracted Notification consumers for the same
events after cutover; that would duplicate outbound channel attempts.

## 5. Verification Performed

| Check | Result |
| --- | --- |
| Contracts typecheck | Pass |
| Contracts build | Pass |
| Notification lint | Pass |
| Notification typecheck | Pass |
| Notification spec/script typecheck with `tsconfig.test.json` | Pass |
| Notification unit tests | 9 suites, 185 tests pass |
| Notification build | Pass |
| Gateway typecheck | Pass |
| Gateway build | Pass |
| Gateway E2E | 3 suites, 15 tests pass |
| API typecheck | Pass |
| API build | Pass |
| API architecture boundary suite | 5 tests pass |
| `docker compose -f docker-compose.dev.yml config --quiet` | Pass |
| Notification migration generation | Pass; `0000_overconfident_scream.sql` generated |

Gateway/API/Notification builds intermittently hit Windows `EPERM` while
unlinking stale `dist` files. Each affected build was rerun successfully after
removing only the resolved package `dist` directory.

## 6. Exit Criteria Status

| Phase 5 criterion | Status |
| --- | --- |
| Duplicate events create one logical notification per recipient/type/business key | Implemented through `inbox_messages` event dedupe and `notifications.idempotency_key`; unit tests cover duplicate notification insert behavior |
| WebSocket reconnect, unread counts, push-token management, email, and FCM pass E2E tests | Code paths implemented and unit/component tests pass for unread counts, push tokens, email, push, and Socket.IO payload emission; real SMTP/FCM/staging client reconnect E2E remains an owner action |
| Notification downtime does not affect checkout or payment processing; backlog drains after recovery | Implemented through RabbitMQ durable queue, manual ack/nack, inbox dedupe, and fire-and-forget provider delivery; staging broker outage drill remains an owner action |

## 7. Owner Actions

- Apply Render Terraform to provision Notification Postgres and
  Notification-owned Key Value in production.
- Add `RENDER_NOTIFICATION_DEPLOY_HOOK`.
- Configure SMTP and Firebase credentials in the Notification service secret
  group only.
- Run direct `db:sync` and optional contact projection seed during a controlled
  cutover window.
- Run staging E2E for Socket.IO reconnect, unread counts, push-token
  management, SMTP, and real FCM.
- Run a RabbitMQ/Notification outage drill and verify backlog drain after
  recovery.
- Monitor `notification.domain-events.v1` queue depth, consumer lag, delivery
  failures, provider error rates, and unread-count Redis errors after cutover.
- Rehearse rollback with `target-to-source` synchronization before production
  cutover.

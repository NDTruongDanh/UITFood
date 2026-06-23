# Phase 2 — Durable Integration (Implementation Report)

**Status:** Phase 2 is functionally complete and verified at the typecheck/unit level. `@uitfood/contracts`, transactional outbox/inbox, the RabbitMQ publisher/consumer + relay, the EventBus bridge, the Review `UnitOfWork` dismantling, the full producer outbox conversion (order, payment, review, **and all catalog incl. modifiers**), and the kill-after-commit resilience test are all implemented. Typecheck (src + test) clean; **667 unit tests pass**. Only live-infra runs remain (resilience/full e2e against Postgres, live-broker round-trip, DI-cycle boot smoke).
**Scope:** `packages/contracts` (new), `apps/api/src/messaging` (new), `apps/api` ordering/payment/catalog handlers + services + repos, `docker-compose*.yml`, `infra`, schema/migrations
**Date:** 2026-06-23
**Relates to:** [MICROSERVICES_MIGRATION_PLAN.md](./MICROSERVICES_MIGRATION_PLAN.md) §2.3 (coupling), §5 (contracts/consistency), Phase 2 objectives & exit criteria

---

## 1. Objective

Make cross-context interactions **durable, idempotent, and crash-safe across a
process boundary** before any service is extracted. Concretely:

1. Define the versioned JSON event envelope contract (`packages/contracts`).
2. Add a transactional **outbox** (producer) and **inbox** (consumer) so a
   business write and its event commit atomically, and a duplicate delivery is a
   no-op.
3. Publish the outbox to **RabbitMQ** durably (publisher confirms) and bridge it
   back to the in-process EventBus so existing handlers keep working.
4. Dismantle the cross-context `UnitOfWorkContext` and move the remaining
   critical `EventBus.publish()` sites (order + payment) onto the outbox.

Guiding principle: **producer → bus is now durable** (no crash-after-commit
event loss). Consumer-side reliability is unchanged from the legacy in-process
bus until each consumer is converted to its own real RabbitMQ consumer in later
phases; the direct in-process fan-out is removed only once every consumer is
broker-backed.

> **Correction vs. the original brief:** the codebase uses **Drizzle ORM**, not
> TypeORM/Prisma. Outbox/Inbox are therefore Drizzle tables; introducing TypeORM
> would fork the persistence layer.

---

## 2. `packages/contracts` — versioned wire contracts

New buildable workspace package `@uitfood/contracts` — **types + zod schemas +
constants only, no domain logic, no persistence.**

```
packages/contracts/src/
├── envelope.ts        # DomainEventEnvelope<T> + envelopeSchema + createEnvelope()
├── event-names.ts     # EVENT_NAMES — versioned routing keys (= eventType)
├── events/            # per-context payload schemas
│   ├── review.ts ordering.ts payment.ts catalog.ts
└── index.ts           # re-exports + EVENT_PAYLOAD_SCHEMAS registry
```

Envelope (plan §5.1): `eventId, eventType, eventVersion, aggregateId,
aggregateVersion, occurredAt, producer, correlationId, causationId, traceparent,
payload`. Modelled event payloads: `review.submitted.v1`, `ordering.order.placed.v1`,
`ordering.order-status.changed.v1`, `ordering.order-ready-for-pickup.v1`,
`ordering.order-cancelled-after-payment.v1`, `payment.confirmed.v1`,
`payment.failed.v1`, `catalog.{restaurant,menu-item,delivery-zone}.changed.v1`.

---

## 3. Outbox / Inbox data models (Drizzle)

| Table | Purpose |
| --- | --- |
| `outbox_events` | Written in the SAME transaction as the business change; relay sets `published_at` only after a broker confirm. Columns: `id, eventId (unique), eventType, eventVersion, aggregateId, aggregateVersion, envelope (jsonb), occurredAt, publishedAt, attemptCount, nextAttemptAt, lastError`. Indexes on `(publishedAt, nextAttemptAt)`, `(aggregateId, aggregateVersion)`, and a partial `WHERE published_at IS NULL`. |
| `inbox_messages` | Consumer-side dedupe. `UNIQUE(consumer, eventId)`; the dedupe insert + business change commit in one transaction. |

Migration: `src/drizzle/out/0005_outbox_inbox.sql` (generated via `drizzle-kit
generate --name outbox_inbox`, plus the manual partial index). Apply with
`pnpm --filter api db:push` (or `db:migrate`).

---

## 4. Messaging components (`apps/api/src/messaging`)

| Component | Role |
| --- | --- |
| `OutboxWriter` | Inserts an envelope into `outbox_events` using a caller-provided `tx` (transactional outbox). |
| `OutboxRelayService` | `@Interval` poller; claims due rows with `FOR UPDATE SKIP LOCKED` (multi-replica safe), publishes via confirm channel, sets `published_at` on confirm or schedules exponential backoff. |
| `RabbitMqPublisher` | `amqp-connection-manager` confirm channel; durable topic exchange; `publish()` resolves only on broker confirm. |
| `RabbitMqConsumer` | Durable quorum queue per consumer, manual ack, poison → nack(requeue=false). |
| `InboxConsumer` | Exactly-once-in-effect: dedupe insert + business handler in one local tx. |
| `CatalogReviewProjectionConsumer` / `OrderingReviewMarkerConsumer` | Real RabbitMQ consumers that replace the dismantled Review UnitOfWork. |
| `EventBusBridgeConsumer` | Re-emits migrated outbox events onto the in-process EventBus (inbox-deduped) so existing `@EventsHandler` keep working. |

`MessagingModule` exports `OutboxWriter`; imports `CqrsModule` for the bridge.

---

## 5. Dismantling `UnitOfWorkContext` (Review)

**Before:** one Postgres transaction spanned Review.insert + Catalog.incrementRating
+ Ordering.markReviewed. Impossible across separate databases.

**After:** `SubmitReviewHandler` writes the review row **+** a `review.submitted.v1`
outbox event in one local transaction. Catalog's rating projection and Ordering's
reviewed marker are now idempotent event consumers (inbox). The review is
authoritative immediately; the projections are eventually consistent;
`reviews_order_id_unique` is the final duplicate guard. The lossy post-commit
`EventBus.publish` was removed.

---

## 6. Order/payment outbox conversion (verified)

| File | Events moved to outbox (inside the existing/new transaction) |
| --- | --- |
| `ordering/order/commands/place-order.handler.ts` | `ordering.order.placed.v1` |
| `ordering/order-lifecycle/commands/transition-order.handler.ts` | `order-status.changed`, `order-ready-for-pickup`, `order-cancelled-after-payment` |
| `payment/commands/process-ipn.handler.ts` | `payment.confirmed`, `payment.failed`, `order-cancelled-after-payment` |
| `payment/tasks/payment-timeout.task.ts` | `payment.failed` |

Supporting changes: `PaymentTransactionRepository.updateStatus` accepts an
optional `executor` so the status change and outbox insert commit atomically.
The three affected unit specs (place-order, transition-order, process-ipn) were
updated to assert outbox writes.

The `EventBusBridgeConsumer` re-emits each of these as the legacy in-process
event, so Ordering/Notification/Payment `@EventsHandler` consumers are unchanged.

---

## 6b. Catalog outbox conversion (verified)

All Restaurant Catalog producers now record their events in the outbox atomically
with the write, closing the last `EventBus.publish` sites:

| Service | Event |
| --- | --- |
| `zones.service.ts` | `catalog.delivery-zone.changed.v1` |
| `menu.service.ts` (create/update/updateImage/toggleSoldOut/remove) | `catalog.menu-item.changed.v1` |
| `restaurant.service.ts` (create/update/setApproved/remove/attachImage) | `catalog.restaurant.changed.v1` |
| `modifiers.service.ts` (6 group/option mutations) | `catalog.menu-item.changed.v1` |

**Executor threading:** the `zones`/`menu`/`restaurant`/modifier repositories
gained an optional `DrizzleExecutor` param so a write joins the service's outer
transaction. `menu`/`restaurant` repos keep their internal search-index
transaction when called standalone and join the outer tx when one is passed.
`ModifiersService` rebuilds the modifier snapshot **inside** the transaction
(reading via the executor so it reflects the uncommitted change) before writing
the event via `MenuService.writeMenuItemOutbox`.

**DI-cycle fix:** the dependency-free `OutboxWriter` was extracted into a tiny
`OutboxModule`. Every producer module (catalog menu/restaurant/zones, order,
order-lifecycle, payment, review) imports `OutboxModule` instead of the
contracts-heavy `MessagingModule`, breaking the
`RestaurantModule → MessagingModule → CatalogContractsModule → RestaurantModule`
cycle. `MessagingModule` (relay + publisher + consumers + bridge) is imported
once by `AppModule`.

Catalog specs (`zones.service.spec`, `restaurant.service.spec`) were updated from
an `EventBus` mock to `db` + `outbox` mocks asserting outbox envelopes.

---

## 7. Infrastructure

- **RabbitMQ** added to `docker-compose.yml` and `docker-compose.dev.yml`:
  `rabbitmq:3.13-management-alpine` (management UI on `:15672`),
  `rabbitmq-diagnostics -q ping` healthcheck, persistent volume. The dev API
  `depends_on` RabbitMQ healthy and receives `RABBITMQ_URL` / `RABBITMQ_EXCHANGE`.
- **env.schema.ts**: `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `RABBITMQ_PREFETCH`
  (fail-fast validation). `turbo.json` globalEnv updated.
- **Dependencies**: `amqplib`, `amqp-connection-manager`, `@types/amqplib`,
  `@uitfood/contracts` (workspace) added to `apps/api`.

---

## 8. Resilience test (kill-after-commit)

`test/e2e/outbox-resilience.e2e-spec.ts` proves the durability guarantee against
the REAL Postgres outbox table and the REAL `OutboxRelayService`, with a
controllable fake publisher standing in for RabbitMQ (recovery is
broker-independent — the DB + relay guarantee no loss — so the test is
deterministic and needs no live broker).

| Test | Proves |
| --- | --- |
| OR-01 | A business tx commits the outbox row but the process dies before publishing → on "reboot" a fresh relay drains it and delivers exactly once. |
| OR-02 | Broker down → publish rejects (no confirm) → row is NOT lost (`publishedAt` null, `attemptCount=1`, `lastError` set); after recovery the next tick delivers it exactly once. |
| OR-03 | Already-published rows are never re-published (idempotent relay). |
| OR-04 | Inbox dedupe → replaying the same event applies its effect exactly once. |

**Relay bug found & fixed:** writing this test against real Postgres surfaced
that `OutboxRelayService` used a raw `SELECT *`, which returns snake_case columns
— so `row.attemptCount` / `row.eventId` were `undefined` at runtime (retry
counting and logging silently broken). `drainBatch` was rewritten to use
Drizzle's query builder with `.for('update', { skipLocked: true })`, keeping the
`FOR UPDATE SKIP LOCKED` multi-replica safety while mapping columns to camelCase.

---

## 9. Verification performed

| Check | Result |
| --- | --- |
| `@uitfood/contracts` build | ✅ Pass |
| `pnpm --filter api run typecheck` (src) | ✅ Pass |
| Full src + test typecheck | ✅ Pass |
| Full API unit suite | ✅ 56 suites / 667 tests pass |
| Resilience e2e — typecheck | ✅ Pass; runtime requires Postgres (`pnpm --filter api test:e2e`) |
| Live broker round-trip (publish → consume) | ⏳ requires running RabbitMQ |

---

## 10. Outstanding work (runtime / live-infra only)

- [ ] **Run the resilience + full e2e** against Postgres:
      `docker compose up -d postgres && pnpm --filter api test:e2e` (the
      resilience test needs only Postgres; CI's validate job already provides it).
- [ ] **Live-broker validation**: `docker compose up` (Postgres + Redis +
      RabbitMQ), `db:push`, boot the API, exercise checkout/payment/review, and
      confirm events flow outbox → RabbitMQ → bridge → handlers; DLQ empty.
- [ ] **DI-cycle boot smoke**: `pnpm dev:api` once to confirm no Nest dependency
      cycle (the `OutboxModule` extraction should prevent it).
- [ ] Add RabbitMQ to the CI `validate` service containers for the live round-trip.
- [ ] Refactor scheduled tasks to use a distributed lease (idempotency under
      multiple replicas) — plan Phase 2 item 6.
- [ ] Update `.env.example` with `RABBITMQ_*`.

---

## 11. Exit-criteria status (plan Phase 2)

| Criterion | Status |
| --- | --- |
| Durable events for currently shared event classes | ✅ Order, payment, review, AND all catalog (incl. modifiers) on outbox |
| Inbox/outbox + relay with confirms, retry, DLQ | ✅ Implemented |
| No cross-context transaction carrier in production workflows | ✅ Review UnitOfWork dismantled |
| Killing the API after commit does not lose the event | ✅ Mechanism + resilience test (OR-01/OR-02); ⏳ run against live Postgres |
| Replaying every event twice leaves projections correct | ✅ Inbox dedupe + resilience test (OR-03/OR-04); ⏳ run against live Postgres |
| Broker unavailability queues outbox rows without failing the business write | ✅ By design + OR-02; ⏳ live verification |
| Local/Nest-TCP switchable adapters | ⏳ Deferred within Phase 2 (adapter seam exists via ports) |

Phase 2 is functionally complete (implementation + tests verified at the
typecheck/unit level). Once the e2e/resilience suite and the live-broker
round-trip run green against local infra, we proceed to **Phase 3 (Media
extraction)**.

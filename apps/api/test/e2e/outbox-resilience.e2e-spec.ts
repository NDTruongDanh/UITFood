/**
 * outbox-resilience.e2e-spec.ts — Phase 2 "kill-after-commit" resilience.
 *
 * Proves the core durability guarantee of the transactional outbox using the
 * REAL Postgres outbox table and the REAL OutboxRelayService, with a
 * controllable fake publisher standing in for RabbitMQ (so the test is
 * deterministic and needs no live broker — the recovery logic is
 * broker-independent: it is the DB + relay that guarantee no loss).
 *
 * Scenarios:
 *  OR-01 Crash-after-commit: a business transaction commits the outbox row but
 *        the process dies before publishing. On "reboot" the relay drains it and
 *        the event is delivered exactly once.
 *  OR-02 Broker down (no publisher confirm): the row is NOT lost — it stays
 *        unpublished, the attempt counter increments, and a later tick delivers
 *        it exactly once.
 *  OR-03 Idempotent relay: an already-published row is never re-published.
 *  OR-04 Inbox dedupe: replaying the same event applies its effect exactly once.
 */

import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import {
  createEnvelope,
  REVIEW_SUBMITTED_V1,
  type DomainEventEnvelope,
} from '@uitfood/contracts';
import { getTestDb } from '../setup/db-setup';
import { outboxEvents } from '../../src/messaging/schema/outbox.schema';
import { inboxMessages } from '../../src/messaging/schema/inbox.schema';
import { OutboxWriter } from '../../src/messaging/outbox/outbox.writer';
import { OutboxRelayService } from '../../src/messaging/outbox/outbox-relay.service';
import { InboxConsumer } from '../../src/messaging/inbox/inbox.consumer';
import type { RabbitMqPublisher } from '../../src/messaging/rabbitmq/rabbitmq.publisher';

/** Controllable stand-in for RabbitMqPublisher. */
class FakePublisher {
  readonly published: DomainEventEnvelope[] = [];
  shouldFail = false;

  publish(envelope: DomainEventEnvelope): Promise<void> {
    if (this.shouldFail) {
      // Simulates broker down / process death before a publisher confirm.
      return Promise.reject(new Error('simulated broker failure (no confirm)'));
    }
    this.published.push(envelope);
    return Promise.resolve();
  }
}

function makeEnvelope(): DomainEventEnvelope {
  return createEnvelope({
    eventType: REVIEW_SUBMITTED_V1.eventType,
    eventVersion: REVIEW_SUBMITTED_V1.eventVersion,
    aggregateId: randomUUID(),
    aggregateVersion: 0,
    producer: 'monolith',
    payload: {
      reviewId: randomUUID(),
      orderId: randomUUID(),
      customerId: randomUUID(),
      restaurantId: randomUUID(),
      stars: 5,
      submittedAt: new Date().toISOString(),
    },
  });
}

describe('Outbox resilience — kill-after-commit (E2E)', () => {
  const db = getTestDb();
  const writer = new OutboxWriter();
  let fake: FakePublisher;

  const getRow = async (eventId: string) => {
    const rows = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.eventId, eventId))
      .limit(1);
    return rows[0] ?? null;
  };

  /** Records the event in the outbox the way a producer does: in one local tx. */
  const commitOutbox = (env: DomainEventEnvelope) =>
    db.transaction((tx) => writer.write(tx, env));

  const newRelay = () =>
    new OutboxRelayService(
      db as never,
      fake as unknown as RabbitMqPublisher,
    );

  beforeEach(async () => {
    await db.delete(outboxEvents);
    await db.delete(inboxMessages);
    fake = new FakePublisher();
  });

  it('OR-01 delivers a committed-but-unpublished event after a relay restart', async () => {
    const env = makeEnvelope();
    // Business tx committed; the process died before the relay could publish.
    await commitOutbox(env);

    let row = await getRow(env.eventId);
    expect(row?.publishedAt).toBeNull(); // crash-after-commit state

    // "Reboot": a fresh relay drains the outbox.
    await newRelay().tick();

    expect(fake.published.map((e) => e.eventId)).toEqual([env.eventId]);
    row = await getRow(env.eventId);
    expect(row?.publishedAt).not.toBeNull();
  });

  it('OR-02 never loses the event when the broker is down, then delivers once', async () => {
    const env = makeEnvelope();
    await commitOutbox(env);

    // Broker down → publish rejects (no confirm).
    fake.shouldFail = true;
    const relay = newRelay();
    await relay.tick();

    let row = await getRow(env.eventId);
    expect(row?.publishedAt).toBeNull(); // NOT lost
    expect(row?.attemptCount).toBe(1);
    expect(row?.lastError).toBeTruthy();
    expect(fake.published).toHaveLength(0);

    // Broker recovers. Clear the backoff so the row is due again, then tick.
    fake.shouldFail = false;
    await db
      .update(outboxEvents)
      .set({ nextAttemptAt: new Date() })
      .where(eq(outboxEvents.eventId, env.eventId));
    await relay.tick();

    expect(fake.published.map((e) => e.eventId)).toEqual([env.eventId]); // exactly once
    row = await getRow(env.eventId);
    expect(row?.publishedAt).not.toBeNull();
  });

  it('OR-03 does not re-publish an already-published event (idempotent relay)', async () => {
    const env = makeEnvelope();
    await commitOutbox(env);

    const relay = newRelay();
    await relay.tick();
    await relay.tick(); // second drain must skip the published row

    expect(
      fake.published.filter((e) => e.eventId === env.eventId),
    ).toHaveLength(1);
  });

  it('OR-04 inbox applies a replayed event exactly once', async () => {
    const env = makeEnvelope();
    const inbox = new InboxConsumer(db as never);
    let effects = 0;
    const handler = () => {
      effects += 1;
      return Promise.resolve();
    };

    await inbox.consume('resilience-test', env, handler);
    await inbox.consume('resilience-test', env, handler); // replay

    expect(effects).toBe(1);
    const rows = await db
      .select()
      .from(inboxMessages)
      .where(
        and(
          eq(inboxMessages.consumer, 'resilience-test'),
          eq(inboxMessages.eventId, env.eventId),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0].processedAt).not.toBeNull();
  });
});

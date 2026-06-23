import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createEnvelope, PAYMENT_FAILED_V1 } from '@uitfood/contracts';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import { OutboxWriter } from '@/messaging/outbox/outbox.writer';
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository';
import { runObserved } from '@/observability/trace';

/**
 * PaymentTimeoutTask
 *
 * Runs every minute and expires payment transactions that have passed
 * their `expiresAt` deadline while still in a non-terminal status
 * (`pending` or `awaiting_ipn`).
 *
 * Scenarios handled:
 *  - `pending`      → URL generation failed before redirect; self-healing expiry.
 *  - `awaiting_ipn` → Customer abandoned the payment page or VNPay never called IPN.
 *
 * For each expired transaction:
 *   1. Transition to `failed` via optimistic locking.
 *   2. Publish `PaymentFailedEvent` — Ordering BC handler (T-03) cancels the order.
 *
 * Multi-pod safety:
 *  Two pods may race on the same transaction. Optimistic locking ensures only
 *  one pod wins the DB update. The losing pod's `updateStatus` returns null
 *  and no event is published, preventing duplicate `PaymentFailedEvent` dispatches.
 *
 * Acceptable delay: up to 60 seconds between expiry and status transition.
 *
 * Phase: 8.5
 */
@Injectable()
export class PaymentTimeoutTask {
  private readonly logger = new Logger(PaymentTimeoutTask.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
    private readonly txnRepo: PaymentTransactionRepository,
    private readonly outbox: OutboxWriter,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredPayments(): Promise<void> {
    return runObserved(
      'cron.payment_timeout',
      { 'job.name': 'PaymentTimeoutTask.handleExpiredPayments' },
      async () => {
        let expired: Awaited<ReturnType<typeof this.txnRepo.findExpired>>;

        try {
          expired = await this.txnRepo.findExpired();
        } catch (err) {
          this.logger.error(
            `PaymentTimeoutTask failed to query expired transactions: ${(err as Error).message}`,
            (err as Error).stack,
          );
          return;
        }

        if (expired.length === 0) return;

        this.logger.log(
          `PaymentTimeoutTask: found ${expired.length} expired transaction(s) to fail.`,
        );

        for (const txn of expired) {
          try {
            // Differentiate reason by status so the cancellation note in Ordering
            // reflects the actual failure mode (never redirected vs. abandoned page).
            // T-03 (pending→cancelled) has requireNote: true — reason MUST be non-empty.
            const reason =
              txn.status === 'pending'
                ? 'Payment session could not be initialised — VNPay URL generation failed before redirect'
                : 'Payment session expired — customer did not complete payment within the allowed time';

            // Atomic: fail the transaction AND record the outbox event together.
            const now = new Date();
            const updated = await this.db.transaction(async (tx) => {
              const u = await this.txnRepo.updateStatus(
                txn.id,
                'failed',
                txn.version,
                {},
                tx,
              );
              if (!u) return null;

              await this.outbox.write(
                tx,
                createEnvelope({
                  eventType: PAYMENT_FAILED_V1.eventType,
                  eventVersion: PAYMENT_FAILED_V1.eventVersion,
                  aggregateId: txn.orderId,
                  aggregateVersion: u.version,
                  producer: 'monolith',
                  payload: {
                    orderId: txn.orderId,
                    customerId: txn.customerId,
                    provider: 'vnpay',
                    reason,
                    failedAt: now.toISOString(),
                  },
                }),
              );
              return u;
            });

            if (!updated) {
              // Optimistic lock lost — another pod/process already resolved it.
              this.logger.warn(
                `PaymentTimeoutTask: optimistic lock lost for txn=${txn.id} — skipping event.`,
              );
              continue;
            }

            this.logger.log(
              `PaymentTimeoutTask: expired txn=${txn.id} order=${txn.orderId} (was ${txn.status}) → failed.`,
            );
          } catch (err) {
            // Log per-transaction failures without aborting the rest of the batch.
            this.logger.error(
              `PaymentTimeoutTask: failed to expire txn=${txn.id}: ${(err as Error).message}`,
              (err as Error).stack,
            );
          }
        }
      },
    );
  }
}

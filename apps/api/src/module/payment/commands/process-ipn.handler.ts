import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  createEnvelope,
  PAYMENT_CONFIRMED_V1,
  PAYMENT_FAILED_V1,
  ORDER_CANCELLED_AFTER_PAYMENT_V1,
} from '@uitfood/contracts';
import { DB_CONNECTION } from '@/drizzle/drizzle.constants';
import { OutboxWriter } from '@/messaging/outbox/outbox.writer';
import { ProcessIpnCommand } from './process-ipn.command';
import { VNPayService } from '../services/vnpay.service';
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository';
import type { PaymentTransaction } from '../domain/payment-transaction.schema';
import { runObserved } from '@/observability/trace';
import { recordPaymentFailure } from '@/observability/domain-metrics';

// ---------------------------------------------------------------------------
// VNPay IPN response codes (defined in VNPay merchant documentation).
// These are the ONLY valid response codes VNPay accepts from our server.
// ---------------------------------------------------------------------------

/** Signature valid and transaction processed successfully. */
const IPN_RSP_SUCCESS = '00';

/** Invalid signature — VNPay will retry until it receives a success response. */
const IPN_RSP_INVALID_SIGNATURE = '97';

/** Transaction not found in our system. */
const IPN_RSP_ORDER_NOT_FOUND = '01';

/** Amount mismatch — the amount VNPay charged differs from what we expect. */
const IPN_RSP_AMOUNT_MISMATCH = '04';

/** Generic unknown error (should never happen in normal operation). */
const IPN_RSP_UNKNOWN_ERROR = '99';

/** IPN response shape — MUST NOT be wrapped in a result envelope. */
export interface IpnResponse {
  RspCode: string;
  Message: string;
}

/**
 * ProcessIpnHandler
 *
 * The authoritative handler for VNPay IPN (Instant Payment Notification) callbacks.
 * IPN is the ONLY mechanism that mutates PaymentTransaction state and publishes
 * payment outcome events. The return URL handler (Phase 8.4) never writes to DB.
 *
 * Security model:
 *   - HMAC SHA512 signature is verified BEFORE any DB read or write.
 *   - All DB mutations use optimistic locking (version field) to prevent
 *     race conditions when VNPay retries the IPN concurrently.
 *   - Amount is validated against the stored transaction to prevent over-
 *     or under-crediting (BR-P4).
 *
 * Idempotency model (handles VNPay's retry mechanism):
 *   - Pre-flight: lookup by vnp_TxnRef (our PaymentTransaction.id = PK).
 *     If the transaction is already in a terminal state (completed/failed/
 *     refund_pending/refunded), return IPN_RSP_SUCCESS immediately without
 *     any further DB access. VNPay considers this a valid acknowledgement.
 *   - Hard backstop: UNIQUE constraint on provider_txn_id in the DB prevents
 *     a second INSERT even if the application-level check races.
 *
 * Event publishing:
 *   - PaymentConfirmedEvent → Ordering BC (T-02: pending → paid)
 *   - PaymentFailedEvent    → Ordering BC (T-03: pending → cancelled)
 *   Published AFTER the DB write commits so the event consumer receives
 *   consistent state.
 *
 * Phase: 8.3
 */
@Injectable()
@CommandHandler(ProcessIpnCommand)
export class ProcessIpnHandler implements ICommandHandler<ProcessIpnCommand> {
  private readonly logger = new Logger(ProcessIpnHandler.name);

  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase,
    private readonly vnpayService: VNPayService,
    private readonly txnRepo: PaymentTransactionRepository,
    private readonly outbox: OutboxWriter,
  ) {}

  async execute(command: ProcessIpnCommand): Promise<IpnResponse> {
    return runObserved(
      'payment.verify',
      { 'payment.provider': 'vnpay', operation: 'ipn' },
      async () => {
        // -------------------------------------------------------------------------
        // Step 1: Verify HMAC SHA512 signature.
        //
        // This MUST be the very first operation — we must not trust any parameter
        // value before the signature is confirmed valid. A spoofed IPN with a valid-
        // looking txnRef would otherwise let an attacker acknowledge fake payments.
        // -------------------------------------------------------------------------
        const verification = this.vnpayService.verifyIpn(command.query);

        if (!verification.valid) {
          recordPaymentFailure({ reason: 'invalid_signature' });
          this.logger.warn(
            `IPN rejected — invalid signature. ` +
              `Raw query keys: [${Object.keys(command.query).join(', ')}]`,
          );
          return {
            RspCode: IPN_RSP_INVALID_SIGNATURE,
            Message: 'Invalid signature',
          };
        }

        const {
          txnRef,
          providerTxnId,
          amount: ipnAmount,
          responsePaid,
        } = verification;

        this.logger.log(
          `IPN received — txnRef=${txnRef} providerTxnId=${providerTxnId} ` +
            `responsePaid=${responsePaid} amount=${ipnAmount}`,
        );

        // -------------------------------------------------------------------------
        // Step 2: Look up the PaymentTransaction by primary key.
        //
        // vnp_TxnRef = PaymentTransaction.id (we set this when building the URL).
        // Using findById() (PK lookup) is the most efficient and precise approach.
        // -------------------------------------------------------------------------
        const txn = await this.txnRepo.findById(txnRef);

        if (!txn) {
          recordPaymentFailure({ reason: 'order_not_found' });
          this.logger.warn(
            `IPN references unknown txnRef=${txnRef} — no PaymentTransaction found.`,
          );
          return {
            RspCode: IPN_RSP_ORDER_NOT_FOUND,
            Message: 'Transaction not found',
          };
        }

        // -------------------------------------------------------------------------
        // Step 3: Idempotency — terminal state check.
        //
        // If the transaction is already in a terminal state, the IPN is a retry
        // from VNPay (they retry until they receive RspCode='00'). Acknowledge
        // immediately without re-processing to prevent double event publishing.
        //
        // Terminal states: completed, refund_pending, refunded.
        // A failed transaction can still receive a late paid IPN and be routed
        // to refund processing.
        // -------------------------------------------------------------------------
        if (txn.status === 'failed' && !responsePaid) {
          this.logger.log(
            `IPN for txnRef=${txnRef} already failed and response is unpaid - acknowledging retry.`,
          );
          return {
            RspCode: IPN_RSP_SUCCESS,
            Message: 'Transaction already failed',
          };
        }

        if (this.isTerminalStatus(txn.status)) {
          this.logger.log(
            `IPN for txnRef=${txnRef} already in terminal status=${txn.status} — ` +
              `acknowledging without re-processing (idempotent response).`,
          );
          return {
            RspCode: IPN_RSP_SUCCESS,
            Message: 'Transaction already processed',
          };
        }

        // -------------------------------------------------------------------------
        // Step 4: Amount validation (BR-P4).
        //
        // Both ipnAmount and txn.amount are integer VND — exact equality is correct.
        // Any mismatch indicates a VNPay bug or a tampering attempt.
        // -------------------------------------------------------------------------
        if (ipnAmount !== txn.amount) {
          this.logger.error(
            `IPN amount mismatch for txnRef=${txnRef}: ` +
              `expected=${txn.amount} received=${ipnAmount} (delta=${Math.abs(ipnAmount - txn.amount)})`,
          );

          if (txn.status !== 'failed') {
            // markFailedAndRecord atomically fails the txn AND records the outbox
            // PaymentFailed event; only the handler that wins the optimistic lock
            // writes the event, preventing duplicates on concurrent VNPay retries.
            const mismatchFailed = await this.markFailedAndRecord(
              txn,
              command.query,
              providerTxnId,
              `IPN amount mismatch: expected ${txn.amount}, got ${ipnAmount}`,
            );
            if (mismatchFailed) {
              recordPaymentFailure({ reason: 'amount_mismatch' });
            }
          }

          return {
            RspCode: IPN_RSP_AMOUNT_MISMATCH,
            Message: 'Amount mismatch',
          };
        }

        // -------------------------------------------------------------------------
        // Step 5: Process the IPN result.
        //
        // responsePaid = true  → vnp_ResponseCode=00 AND vnp_TransactionStatus=00
        //                        Bank approved the charge.
        // responsePaid = false → Any other code (bank declined, user cancelled, etc.)
        // -------------------------------------------------------------------------
        if (responsePaid && txn.status === 'failed') {
          return this.handleLatePaidAfterFailure(
            txn,
            command.query,
            providerTxnId,
            ipnAmount,
          );
        }

        if (responsePaid) {
          return this.handleSuccess(
            txn,
            command.query,
            providerTxnId,
            ipnAmount,
          );
        } else {
          const responseCode = command.query['vnp_ResponseCode'] ?? 'unknown';
          return this.handleFailure(
            txn,
            command.query,
            providerTxnId,
            responseCode,
          );
        }
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Private — success path
  // ---------------------------------------------------------------------------

  /**
   * Marks the transaction as 'completed' and publishes PaymentConfirmedEvent.
   *
   * Uses optimistic locking — if the version has changed since we read the
   * record, another process (e.g. concurrent IPN retry) won the race.
   * We return success either way because the intent is fulfilled.
   */
  private async handleSuccess(
    txn: PaymentTransaction,
    rawQuery: Record<string, string>,
    providerTxnId: string,
    paidAmount: number,
  ): Promise<IpnResponse> {
    const now = new Date();

    // Atomic: mark completed AND record the PaymentConfirmed outbox event.
    const updated = await this.db.transaction(async (tx) => {
      const u = await this.txnRepo.updateStatus(
        txn.id,
        'completed',
        txn.version,
        {
          // Normalize empty string to null — VNPay omits vnp_TransactionNo in rare
          // edge cases. Storing '' would trip the UNIQUE constraint on a retry.
          providerTxnId: providerTxnId || null,
          vnpResponseCode: rawQuery['vnp_ResponseCode'] ?? null,
          rawIpnPayload: { ...rawQuery },
          ipnReceivedAt: now,
          paidAt: now,
        },
        tx,
      );
      if (!u) return null;

      await this.outbox.write(
        tx,
        createEnvelope({
          eventType: PAYMENT_CONFIRMED_V1.eventType,
          eventVersion: PAYMENT_CONFIRMED_V1.eventVersion,
          aggregateId: txn.orderId,
          aggregateVersion: u.version,
          producer: 'monolith',
          payload: {
            orderId: txn.orderId,
            customerId: txn.customerId,
            provider: 'vnpay',
            amount: paidAmount,
            providerTxnId: providerTxnId || '',
            confirmedAt: now.toISOString(),
          },
        }),
      );
      return u;
    });

    if (!updated) {
      // Optimistic lock lost — a concurrent IPN handler already processed this.
      this.logger.warn(
        `IPN success: optimistic lock lost for txn=${txn.id} ` +
          `(concurrent processing). Re-reading for terminal check.`,
      );

      const current = await this.txnRepo.findById(txn.id);
      if (current && this.isTerminalStatus(current.status)) {
        this.logger.log(
          `Concurrent IPN handler completed txn=${txn.id} with status=${current.status}.`,
        );
        return { RspCode: IPN_RSP_SUCCESS, Message: 'Confirmed' };
      }

      return {
        RspCode: IPN_RSP_UNKNOWN_ERROR,
        Message: 'Concurrent processing conflict',
      };
    }

    this.logger.log(
      `Payment CONFIRMED: txn=${txn.id} order=${txn.orderId} ` +
        `amount=${paidAmount} providerTxnId=${providerTxnId}`,
    );

    return { RspCode: IPN_RSP_SUCCESS, Message: 'Confirmed' };
  }

  /**
   * VNPay can deliver a successful IPN after our timeout task has already
   * failed the attempt and cancelled the order. In that case the order must
   * not become successful; we persist the charge and route it to refund.
   */
  private async handleLatePaidAfterFailure(
    txn: PaymentTransaction,
    rawQuery: Record<string, string>,
    providerTxnId: string,
    paidAmount: number,
  ): Promise<IpnResponse> {
    const now = new Date();

    // Atomic: mark completed AND record the refund-trigger outbox event.
    const updated = await this.db.transaction(async (tx) => {
      const u = await this.txnRepo.updateStatus(
        txn.id,
        'completed',
        txn.version,
        {
          providerTxnId: providerTxnId || null,
          vnpResponseCode: rawQuery['vnp_ResponseCode'] ?? null,
          rawIpnPayload: { ...rawQuery },
          ipnReceivedAt: now,
          paidAt: now,
        },
        tx,
      );
      if (!u) return null;

      await this.outbox.write(
        tx,
        createEnvelope({
          eventType: ORDER_CANCELLED_AFTER_PAYMENT_V1.eventType,
          eventVersion: ORDER_CANCELLED_AFTER_PAYMENT_V1.eventVersion,
          aggregateId: txn.orderId,
          aggregateVersion: u.version,
          producer: 'monolith',
          payload: {
            orderId: txn.orderId,
            customerId: txn.customerId,
            paymentMethod: 'vnpay',
            paidAmount,
            cancelledByRole: 'system',
            cancelledAt: now.toISOString(),
          },
        }),
      );
      return u;
    });

    if (!updated) {
      this.logger.warn(
        `Late paid IPN: optimistic lock lost for failed txn=${txn.id}. Re-reading for terminal check.`,
      );

      const current = await this.txnRepo.findById(txn.id);
      if (current && this.isTerminalStatus(current.status)) {
        return {
          RspCode: IPN_RSP_SUCCESS,
          Message: 'Late payment already reconciled',
        };
      }

      return {
        RspCode: IPN_RSP_UNKNOWN_ERROR,
        Message: 'Concurrent processing conflict',
      };
    }

    this.logger.warn(
      `Late VNPay payment received after failure: txn=${txn.id} order=${txn.orderId} amount=${paidAmount}. Queuing refund.`,
    );

    return {
      RspCode: IPN_RSP_SUCCESS,
      Message: 'Late paid transaction queued for refund',
    };
  }

  // ---------------------------------------------------------------------------
  // Private — failure path
  // ---------------------------------------------------------------------------

  /**
   * Marks the transaction as 'failed' and publishes PaymentFailedEvent.
   * The human-readable reason is derived from the VNPay response code.
   */
  private async handleFailure(
    txn: PaymentTransaction,
    rawQuery: Record<string, string>,
    providerTxnId: string,
    responseCode: string,
  ): Promise<IpnResponse> {
    // Only record the event if THIS handler won the optimistic lock. A concurrent
    // IPN retry may have already failed the txn and recorded the event; recording
    // again would dispatch a second T-03 cancel, which is wasteful.
    const reason = `VNPay declined payment — responseCode=${responseCode}`;
    const failed = await this.markFailedAndRecord(
      txn,
      rawQuery,
      providerTxnId,
      reason,
    );
    if (failed) {
      recordPaymentFailure({ reason: 'declined', responseCode });
      this.logger.log(
        `Payment FAILED: txn=${txn.id} order=${txn.orderId} ` +
          `responseCode=${responseCode}`,
      );
    }

    // Always return IPN_RSP_SUCCESS to VNPay after processing a failed payment.
    // IPN_RSP_INVALID_SIGNATURE is reserved for actual signature errors only.
    // Returning '00' here means VNPay stops retrying — our side handled it.
    return { RspCode: IPN_RSP_SUCCESS, Message: 'Processed' };
  }

  // ---------------------------------------------------------------------------
  // Private — shared helpers
  // ---------------------------------------------------------------------------

  /**
   * Atomically writes the 'failed' terminal state AND records the PaymentFailed
   * outbox event in one transaction (optimistic locking).
   *
   * `reason` MUST be non-empty — the downstream T-03 transition requires a note.
   *
   * Returns true  — this handler won the lock; the event was recorded.
   * Returns false — another concurrent handler already resolved the transaction;
   *                 no event recorded (prevents duplicates).
   */
  private async markFailedAndRecord(
    txn: PaymentTransaction,
    rawQuery: Record<string, string>,
    providerTxnId: string,
    reason: string,
  ): Promise<boolean> {
    const now = new Date();

    const updated = await this.db.transaction(async (tx) => {
      const u = await this.txnRepo.updateStatus(
        txn.id,
        'failed',
        txn.version,
        {
          providerTxnId: providerTxnId || null,
          vnpResponseCode: rawQuery['vnp_ResponseCode'] ?? null,
          rawIpnPayload: { ...rawQuery },
          ipnReceivedAt: now,
        },
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
      this.logger.warn(
        `markFailedAndRecord: optimistic lock lost for txn=${txn.id} — another process resolved it first.`,
      );
      return false;
    }

    return true;
  }

  /**
   * Returns true if the status is a terminal state that no longer accepts IPN.
   * Terminal states must not be overwritten by a late or retried IPN.
   */
  private isTerminalStatus(status: PaymentTransaction['status']): boolean {
    return (
      status === 'completed' ||
      status === 'refund_pending' ||
      status === 'refunded'
    );
  }
}

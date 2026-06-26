import { z } from 'zod';

/**
 * Payment service synchronous TCP RPC contracts (Phase 7 - Payment wave).
 *
 * The public VNPay HTTP surface stays at `/api/payments/**`; the gateway
 * translates those routes to these TCP patterns. Ordering uses the same
 * contracts for payment-attempt creation, failure marking, and pending-payment
 * cancellation.
 */
export const PAYMENT_RPC_PATTERNS = {
  createAttempt: 'payment.attempt.create.v1',
  markAttemptFailed: 'payment.attempt.fail.v1',
  cancelPendingAttempt: 'payment.attempt.cancel-pending.v1',
  processIpn: 'payment.ipn.process.v1',
  resolveReturn: 'payment.return.resolve.v1',
  resolveMobileReturn: 'payment.mobile-return.resolve.v1',
  listMyTransactions: 'payment.transactions.my.v1',
} as const;

export type PaymentRpcPattern =
  (typeof PAYMENT_RPC_PATTERNS)[keyof typeof PAYMENT_RPC_PATTERNS];

export const paymentRpcErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean().default(false),
});
export type PaymentRpcError = z.infer<typeof paymentRpcErrorSchema>;

const uuid = z.string().uuid();
const vnd = z.number().int().nonnegative();

export const paymentStatusSchema = z.enum([
  'pending',
  'awaiting_ipn',
  'completed',
  'failed',
  'refund_pending',
  'refunded',
]);
export type PaymentStatusDto = z.infer<typeof paymentStatusSchema>;

export const paymentAttemptCreateRequestSchema = z.object({
  internalAuth: z.string().min(1),
  orderId: uuid,
  customerId: uuid,
  amount: vnd.refine((amount) => amount > 0, {
    message: 'amount must be greater than 0',
  }),
  ipAddr: z.string().min(1),
});
export type PaymentAttemptCreateRequest = z.infer<
  typeof paymentAttemptCreateRequestSchema
>;

export const paymentAttemptCreateResponseSchema = z.object({
  txnId: uuid,
  paymentUrl: z.string().url(),
});
export type PaymentAttemptCreateResponse = z.infer<
  typeof paymentAttemptCreateResponseSchema
>;

export const paymentAttemptFailRequestSchema = z.object({
  internalAuth: z.string().min(1),
  txnId: uuid,
  reason: z.string().min(1),
});
export type PaymentAttemptFailRequest = z.infer<
  typeof paymentAttemptFailRequestSchema
>;

export const paymentPendingCancelRequestSchema = z.object({
  internalAuth: z.string().min(1),
  orderId: uuid,
  customerId: uuid,
  reason: z.string().min(1).optional(),
});
export type PaymentPendingCancelRequest = z.infer<
  typeof paymentPendingCancelRequestSchema
>;

export const paymentPendingCancelResponseSchema = z.object({
  id: uuid,
  orderId: uuid,
  status: paymentStatusSchema,
  updatedAt: z.coerce.date(),
});
export type PaymentPendingCancelResponse = z.infer<
  typeof paymentPendingCancelResponseSchema
>;

export const paymentVnpayQuerySchema = z.record(z.string(), z.string());
export type PaymentVnpayQuery = z.infer<typeof paymentVnpayQuerySchema>;

export const paymentIpnProcessRequestSchema = z.object({
  query: paymentVnpayQuerySchema,
});
export type PaymentIpnProcessRequest = z.infer<
  typeof paymentIpnProcessRequestSchema
>;

export const paymentIpnResponseSchema = z.object({
  RspCode: z.string(),
  Message: z.string(),
});
export type PaymentIpnResponse = z.infer<typeof paymentIpnResponseSchema>;

export const paymentReturnResolveRequestSchema = z.object({
  query: paymentVnpayQuerySchema,
});
export type PaymentReturnResolveRequest = z.infer<
  typeof paymentReturnResolveRequestSchema
>;

export const paymentReturnResponseSchema = z.object({
  txnRef: z.string(),
  orderId: z.string(),
  status: z.union([paymentStatusSchema, z.literal('unknown')]),
  signatureValid: z.boolean(),
  vnpResponseCode: z.string().nullable(),
});
export type PaymentReturnResponse = z.infer<
  typeof paymentReturnResponseSchema
>;

export const paymentMobileReturnResponseSchema = z.object({
  redirectUrl: z.string().url(),
});
export type PaymentMobileReturnResponse = z.infer<
  typeof paymentMobileReturnResponseSchema
>;

export const paymentTransactionsMineRequestSchema = z.object({
  internalAuth: z.string().min(1),
});
export type PaymentTransactionsMineRequest = z.infer<
  typeof paymentTransactionsMineRequestSchema
>;

export const paymentTransactionSummarySchema = z.object({
  id: uuid,
  orderId: uuid,
  amount: vnd,
  status: paymentStatusSchema,
  paidAt: z.coerce.date().nullable(),
  providerTxnId: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type PaymentTransactionSummary = z.infer<
  typeof paymentTransactionSummarySchema
>;

export const paymentTransactionsMineResponseSchema = z.array(
  paymentTransactionSummarySchema,
);
export type PaymentTransactionsMineResponse = z.infer<
  typeof paymentTransactionsMineResponseSchema
>;

export const PAYMENT_INITIATION_PORT = Symbol('PAYMENT_INITIATION_PORT');

export class PaymentInitiationFailedError extends Error {
  constructor(
    message: string,
    public readonly phase:
      | 'transaction_create'
      | 'url_generation'
      | 'transaction_update'
      | 'transaction_fail',
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PaymentInitiationFailedError';
    Object.setPrototypeOf(this, PaymentInitiationFailedError.prototype);
  }
}

export interface IPaymentInitiationPort {
  initiateVNPayPayment(
    orderId: string,
    customerId: string,
    amount: number,
    ipAddr: string,
  ): Promise<{ txnId: string; paymentUrl: string }>;

  markPaymentAttemptFailed(txnId: string, reason: string): Promise<void>;

  cancelPendingPaymentForOrder(
    orderId: string,
    customerId: string,
    reason?: string,
  ): Promise<{
    id: string;
    orderId: string;
    status: string;
    updatedAt: Date;
  }>;
}

export type OrderCancelledAfterPaymentRole =
  | 'customer'
  | 'restaurant'
  | 'admin'
  | 'system';

export class OrderCancelledAfterPaymentEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly paymentMethod: 'vnpay',
    public readonly paidAmount: number,
    public readonly cancelledAt: Date,
    public readonly cancelledByRole: OrderCancelledAfterPaymentRole,
  ) {}
}

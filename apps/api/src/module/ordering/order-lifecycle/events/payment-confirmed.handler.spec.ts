import { EventBus } from '@nestjs/cqrs';
import { PaymentConfirmedEvent } from '@/shared/events/payment-confirmed.event';
import { OrderPlacedEvent } from '@/shared/events/order-placed.event';
import { PaymentConfirmedEventHandler } from './payment-confirmed.handler';

describe('PaymentConfirmedEventHandler', () => {
  const commandBus = {
    execute: jest.fn(),
  };
  const eventBus = {
    publish: jest.fn(),
  };
  const orderRepo = {
    findById: jest.fn(),
    findWithItems: jest.fn(),
  };

  let handler: PaymentConfirmedEventHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new PaymentConfirmedEventHandler(
      commandBus as any,
      eventBus as unknown as EventBus,
      orderRepo as any,
    );
  });

  it('publishes a fulfillment-ready order event only after VNPay payment is confirmed', async () => {
    const order = {
      id: '11111111-1111-4111-8111-111111111111',
      customerId: '22222222-2222-4222-8222-222222222222',
      restaurantId: '33333333-3333-4333-8333-333333333333',
      restaurantName: 'Paid Restaurant',
      status: 'pending',
      paymentMethod: 'vnpay',
      totalAmount: 15000,
      shippingFee: 0,
      deliveryAddress: { street: '1 Test St' },
      estimatedDeliveryMinutes: 30,
    };
    orderRepo.findById.mockResolvedValue(order);
    orderRepo.findWithItems.mockResolvedValue({
      order: { ...order, status: 'paid' },
      items: [
        {
          menuItemId: '44444444-4444-4444-8444-444444444444',
          itemName: 'Paid item',
          quantity: 1,
          unitPrice: 15000,
        },
      ],
    });
    commandBus.execute.mockResolvedValue({ ...order, status: 'paid' });

    await handler.handle(
      new PaymentConfirmedEvent(
        order.id,
        order.customerId,
        'vnpay',
        order.totalAmount,
        new Date(),
      ),
    );

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    const published = eventBus.publish.mock.calls[0][0] as OrderPlacedEvent;
    expect(published).toBeInstanceOf(OrderPlacedEvent);
    expect(published.paymentMethod).toBe('vnpay');
    expect(published.readyForFulfillment).toBe(true);
  });
});

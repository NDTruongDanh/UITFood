import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  EVENT_NAMES,
  orderPlacedV1Payload,
  orderStatusChangedV1Payload,
  type DomainEventEnvelope,
} from '@uitfood/contracts';
import { RabbitMqConsumer } from '@/messaging/rabbitmq/rabbitmq.consumer';
import { InboxConsumer } from '@/messaging/inbox/inbox.consumer';
import { reportingOrderFacts } from '@/reporting/projections/schema/order-fact.schema';
import { reportingOrderItemFacts } from '@/reporting/projections/schema/order-item-fact.schema';

/**
 * Maintains the order + order-item fact projections from Ordering events.
 *
 *  - `ordering.order.placed.v1`         → upsert the order fact + insert item facts.
 *  - `ordering.order-status.changed.v1` → update status; stamp confirmedAt /
 *    readyAt so the prep-time analytics need no status-log self-join.
 *
 * Every apply is idempotent (inbox dedupe + ON CONFLICT upserts), so replayed or
 * reordered deliveries converge to the same projection.
 */
@Injectable()
export class OrderProjectionConsumer implements OnApplicationBootstrap {
  static readonly CONSUMER = 'reporting.order-projection';
  static readonly QUEUE = 'reporting.ordering-events.v1';
  private readonly logger = new Logger(OrderProjectionConsumer.name);

  constructor(
    private readonly consumer: RabbitMqConsumer,
    private readonly inbox: InboxConsumer,
  ) {}

  onApplicationBootstrap(): void {
    this.consumer.subscribe({
      queue: OrderProjectionConsumer.QUEUE,
      routingKeys: [
        EVENT_NAMES.OrderingOrderPlaced,
        EVENT_NAMES.OrderingOrderStatusChanged,
      ],
      handler: (envelope) => this.handle(envelope),
    });
  }

  private async handle(envelope: DomainEventEnvelope): Promise<void> {
    if (envelope.eventType === EVENT_NAMES.OrderingOrderPlaced) {
      return this.handlePlaced(envelope);
    }
    if (envelope.eventType === EVENT_NAMES.OrderingOrderStatusChanged) {
      return this.handleStatusChanged(envelope);
    }
  }

  private async handlePlaced(envelope: DomainEventEnvelope): Promise<void> {
    const p = orderPlacedV1Payload.parse(envelope.payload);
    await this.inbox.consume(
      OrderProjectionConsumer.CONSUMER,
      envelope,
      async (tx) => {
        await tx
          .insert(reportingOrderFacts)
          .values({
            orderId: p.orderId,
            restaurantId: p.restaurantId,
            restaurantName: p.restaurantName,
            status: 'pending',
            totalAmount: p.totalAmount,
            shippingFee: p.shippingFee,
            district: p.deliveryAddress.district ?? null,
            placedAt: new Date(p.placedAt),
          })
          // If a status-changed event arrived first (reordering), a placeholder
          // row exists — fill the descriptive fields but never clobber the status
          // or the confirmed/ready timestamps already projected.
          .onConflictDoUpdate({
            target: reportingOrderFacts.orderId,
            set: {
              restaurantId: p.restaurantId,
              restaurantName: p.restaurantName,
              totalAmount: p.totalAmount,
              shippingFee: p.shippingFee,
              district: p.deliveryAddress.district ?? null,
              placedAt: new Date(p.placedAt),
            },
          });

        if (p.items.length > 0) {
          await tx
            .insert(reportingOrderItemFacts)
            .values(
              p.items.map((item) => ({
                orderId: p.orderId,
                menuItemId: item.menuItemId,
                itemName: item.name,
                quantity: item.quantity,
                revenue: item.unitPrice * item.quantity,
              })),
            )
            .onConflictDoNothing({
              target: [
                reportingOrderItemFacts.orderId,
                reportingOrderItemFacts.menuItemId,
              ],
            });
        }
      },
    );
  }

  private async handleStatusChanged(
    envelope: DomainEventEnvelope,
  ): Promise<void> {
    const p = orderStatusChangedV1Payload.parse(envelope.payload);
    await this.inbox.consume(
      OrderProjectionConsumer.CONSUMER,
      envelope,
      async (tx) => {
        const changedAt = new Date(p.changedAt);
        await tx
          .insert(reportingOrderFacts)
          .values({
            orderId: p.orderId,
            restaurantId: p.restaurantId,
            restaurantName: '',
            status: p.toStatus,
            totalAmount: 0,
            shippingFee: 0,
            placedAt: changedAt,
            confirmedAt: p.toStatus === 'confirmed' ? changedAt : null,
            readyAt: p.toStatus === 'ready_for_pickup' ? changedAt : null,
          })
          .onConflictDoUpdate({
            target: reportingOrderFacts.orderId,
            set: {
              status: p.toStatus,
              ...(p.toStatus === 'confirmed' && { confirmedAt: changedAt }),
              ...(p.toStatus === 'ready_for_pickup' && { readyAt: changedAt }),
            },
          });
      },
    );
  }
}

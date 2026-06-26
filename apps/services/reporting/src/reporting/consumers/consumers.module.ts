import { Module } from '@nestjs/common';
import { MessagingModule } from '@/messaging/messaging.module';
import { OrderProjectionConsumer } from './order-projection.consumer';
import { RestaurantProjectionConsumer } from './restaurant-projection.consumer';

/**
 * Projection consumers — the event-fed write side of the Reporting service.
 * They self-subscribe on bootstrap and maintain the fact tables that the
 * analytics reads query.
 */
@Module({
  imports: [MessagingModule],
  providers: [OrderProjectionConsumer, RestaurantProjectionConsumer],
})
export class ConsumersModule {}

import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging.module';
import { RestaurantModule } from '@/restaurant/restaurant.module';
import { ReviewRatingConsumer } from './review-rating.consumer';

/**
 * Inbound event consumers. Imports MessagingModule (RabbitMqConsumer +
 * InboxConsumer) and RestaurantModule (RESTAURANT_ACCESS_PORT) so the rating
 * projection can apply `review.submitted.v1` events.
 */
@Module({
  imports: [MessagingModule, RestaurantModule],
  providers: [ReviewRatingConsumer],
})
export class ConsumersModule {}

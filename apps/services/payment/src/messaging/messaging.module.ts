import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/database.module';
import { RabbitMqPublisher } from './rabbitmq/rabbitmq.publisher';
import { RabbitMqConsumer } from './rabbitmq/rabbitmq.consumer';
import { OutboxRelayService } from './outbox/outbox-relay.service';
import { InboxConsumer } from './inbox/inbox.consumer';

@Module({
  imports: [DatabaseModule],
  providers: [
    OutboxRelayService,
    RabbitMqPublisher,
    RabbitMqConsumer,
    InboxConsumer,
  ],
  exports: [RabbitMqConsumer, InboxConsumer],
})
export class MessagingModule {}

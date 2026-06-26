import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/database.module';
import { RabbitMqConsumer } from './rabbitmq/rabbitmq.consumer';
import { InboxConsumer } from './inbox/inbox.consumer';

/**
 * MessagingModule — Reporting's inbound durable-integration runtime.
 *
 * Reporting is a pure event consumer (it publishes nothing), so there is no
 * outbox/relay here — only the RabbitMQ consumer + the inbox deduplicator that
 * the projection consumers use to apply each domain event exactly once.
 */
@Module({
  imports: [DatabaseModule],
  providers: [RabbitMqConsumer, InboxConsumer],
  exports: [RabbitMqConsumer, InboxConsumer],
})
export class MessagingModule {}

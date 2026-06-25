import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from '@/config/env.schema';
import { DatabaseModule } from '@/drizzle/database.module';
import { ManagementController } from '@/management/management.controller';

/**
 * Catalog service root module (Phase 6 scaffold).
 *
 * Subsequent steps add: the domain modules (restaurant, menu, modifiers, zones,
 * nutrition, dietary-tags, search), the RPC controllers (`@MessagePattern`),
 * the messaging module (outbox writer/relay + RabbitMQ publisher and the raw
 * consumer for inbound projections like review ratings), and the Identity/Media
 * TCP client adapters.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate }), DatabaseModule],
  controllers: [ManagementController],
})
export class AppModule {}

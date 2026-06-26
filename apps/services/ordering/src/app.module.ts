import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { validate } from '@/config/env.schema';
import { DatabaseModule } from '@/drizzle/database.module';
import { RedisModule } from '@/lib/redis/redis.module';
import { AuthModule } from '@/auth/auth.module';
import { ManagementController } from '@/management/management.controller';

/**
 * Ordering root module.
 *
 * Step 1 scaffold: validated config, CQRS, scheduling, the owned Postgres + Redis
 * connections, internal-auth, and management endpoints. The domain modules (cart,
 * order, lifecycle, history, ACL), the messaging module, the checkout-saga RPC
 * controllers, and the Catalog snapshot consumers are wired in Step 2+.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    CqrsModule,
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,
    AuthModule,
  ],
  controllers: [ManagementController],
})
export class AppModule {}

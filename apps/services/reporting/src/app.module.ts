import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from '@/config/env.schema';
import { DatabaseModule } from '@/drizzle/database.module';
import { AuthModule } from '@/auth/auth.module';
import { MessagingModule } from '@/messaging/messaging.module';
import { ConsumersModule } from '@/reporting/consumers/consumers.module';
import { ReportingModule } from '@/reporting/reporting.module';
import { RpcModule } from '@/rpc/rpc.module';
import { ManagementController } from '@/management/management.controller';

/**
 * Reporting root module.
 *
 * Validated config + the owned Postgres projection database + internal-auth, the
 * inbound messaging runtime, the projection consumers (event-fed write side), the
 * analytics read side, the TCP RPC surface, and management endpoints. Reporting
 * publishes nothing and reads no other service's database.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    DatabaseModule,
    AuthModule,
    MessagingModule,
    ConsumersModule,
    ReportingModule,
    RpcModule,
  ],
  controllers: [ManagementController],
})
export class AppModule {}

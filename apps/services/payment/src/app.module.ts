import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validate } from '@/config/env.schema';
import { vnpayConfig } from '@/config/vnpay.config';
import { DatabaseModule } from '@/drizzle/database.module';
import { AuthModule } from '@/auth/auth.module';
import { PaymentModule } from '@/payment/payment.module';
import { RpcModule } from '@/rpc/rpc.module';
import { MessagingModule } from '@/messaging/messaging.module';
import { PaymentConsumersModule } from '@/messaging/consumers/payment-consumers.module';
import { ManagementController } from '@/management/management.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [vnpayConfig], validate }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    MessagingModule,
    PaymentModule,
    RpcModule,
    PaymentConsumersModule,
  ],
  controllers: [ManagementController],
})
export class AppModule {}

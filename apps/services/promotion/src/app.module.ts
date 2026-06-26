import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validate } from '@/config/env.schema';
import { DatabaseModule } from '@/drizzle/database.module';
import { AuthModule } from '@/auth/auth.module';
import { PromotionModule } from '@/promotion/promotion.module';
import { RpcModule } from '@/rpc/rpc.module';
import { ManagementController } from '@/management/management.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    PromotionModule,
    RpcModule,
  ],
  controllers: [ManagementController],
})
export class AppModule {}

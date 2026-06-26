import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { PromotionModule } from '@/promotion/promotion.module';
import { PromotionRpcController } from './promotion-rpc.controller';

@Module({
  imports: [AuthModule, PromotionModule],
  controllers: [PromotionRpcController],
})
export class RpcModule {}

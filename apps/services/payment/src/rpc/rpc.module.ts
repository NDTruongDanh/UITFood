import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { PaymentModule } from '@/payment/payment.module';
import { PaymentRpcController } from './payment-rpc.controller';

@Module({
  imports: [AuthModule, PaymentModule],
  controllers: [PaymentRpcController],
})
export class RpcModule {}

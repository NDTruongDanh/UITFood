import { Module } from '@nestjs/common';
import { MessagingModule } from '@/messaging/messaging.module';
import { PaymentModule } from '@/payment/payment.module';
import { OrderCancelledAfterPaymentConsumer } from './order-cancelled-after-payment.consumer';

@Module({
  imports: [MessagingModule, PaymentModule],
  providers: [OrderCancelledAfterPaymentConsumer],
})
export class PaymentConsumersModule {}

import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/database.module';
import { PROMOTION_APPLICATION_PORT } from '@/shared/ports/promotion-application.port';

import { PromotionRepository } from './repositories/promotion.repository';
import { CouponCodeRepository } from './repositories/coupon-code.repository';
import { PromotionUsageRepository } from './repositories/promotion-usage.repository';
import { PromotionService } from './services/promotion.service';
import { PromotionReservationCleanupTask } from './tasks/promotion-reservation-cleanup.task';

/**
 * Promotion bounded context. The extracted service owns the discount lifecycle
 * (preview/reserve/confirm/rollback) + the public active-promotion read. The
 * REST controllers and the restaurant/admin management surfaces are NOT part of
 * this wave; they remain in the monolith until a later cutover.
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    PromotionRepository,
    CouponCodeRepository,
    PromotionUsageRepository,
    PromotionService,
    PromotionReservationCleanupTask,
    {
      provide: PROMOTION_APPLICATION_PORT,
      useExisting: PromotionService,
    },
  ],
  exports: [PROMOTION_APPLICATION_PORT, PromotionService],
})
export class PromotionModule {}

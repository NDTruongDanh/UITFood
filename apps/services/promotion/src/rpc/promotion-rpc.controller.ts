import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  PROMOTION_RPC_PATTERNS,
  discountPreviewParamsSchema,
  discountReservationParamsSchema,
  listActivePromotionsRequestSchema,
  reservationByOrderRequestSchema,
  type PreviewDiscountRequest,
  type ReserveDiscountRequest,
  type ReservationByOrderRequest,
  type ListActivePromotionsRequest,
} from '@uitfood/contracts';
import { PromotionService } from '@/promotion/services/promotion.service';
import { InternalAuthService } from '@/auth/internal-auth.service';
import { asPromotionRpcException } from './promotion-rpc.errors';

/**
 * Promotion TCP RPC surface — the discount lifecycle + the public active-promotion
 * read. Lifecycle calls verify the inbound `aud=promotion` internal JWT; the
 * public list is anonymous.
 */
@Controller()
export class PromotionRpcController {
  constructor(
    private readonly service: PromotionService,
    private readonly auth: InternalAuthService,
  ) {}

  @MessagePattern(PROMOTION_RPC_PATTERNS.previewDiscount)
  async preview(@Payload() p: PreviewDiscountRequest) {
    try {
      this.auth.verifyPromotionToken(p.internalAuth);
      const params = discountPreviewParamsSchema.parse(p.params);
      return await this.service.previewDiscount(params);
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.reserveDiscount)
  async reserve(@Payload() p: ReserveDiscountRequest) {
    try {
      this.auth.verifyPromotionToken(p.internalAuth);
      const params = discountReservationParamsSchema.parse(p.params);
      return await this.service.computeAndReserveDiscount(params);
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.confirmReservations)
  async confirm(@Payload() p: ReservationByOrderRequest) {
    try {
      this.auth.verifyPromotionToken(p.internalAuth);
      const { orderId } = reservationByOrderRequestSchema.parse(p);
      await this.service.confirmReservations(orderId);
      return { ok: true };
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.rollbackReservations)
  async rollback(@Payload() p: ReservationByOrderRequest) {
    try {
      this.auth.verifyPromotionToken(p.internalAuth);
      const { orderId } = reservationByOrderRequestSchema.parse(p);
      await this.service.rollbackReservations(orderId);
      return { ok: true };
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }

  @MessagePattern(PROMOTION_RPC_PATTERNS.listActivePromotions)
  async listActive(@Payload() p: ListActivePromotionsRequest) {
    try {
      const { restaurantId } = listActivePromotionsRequestSchema.parse(p ?? {});
      return await this.service.listPublicActive(restaurantId, new Date());
    } catch (e) {
      throw asPromotionRpcException(e);
    }
  }
}

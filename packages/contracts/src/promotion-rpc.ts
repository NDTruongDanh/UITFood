import { z } from 'zod';

/**
 * Promotion service synchronous TCP RPC contracts (Phase 7 — Promotion wave).
 *
 * Pattern values are versioned strings used as Nest `@MessagePattern()` keys and
 * `ClientProxy.send()` patterns. The gateway translates public HTTP routes into
 * these patterns; the monolith Ordering BC reaches the same discount lifecycle
 * over RPC instead of an in-process port.
 *
 * Every lifecycle call carries `internalAuth` — a short-lived internal JWT with
 * `aud=promotion`. The gateway issues a user-scoped token for the public
 * preview; the monolith Ordering adapter issues a `service:api` token for
 * reserve/confirm/rollback. `listActivePromotions` is anonymous (no auth).
 */
export const PROMOTION_RPC_PATTERNS = {
  previewDiscount: 'promotion.discount.preview.v1',
  reserveDiscount: 'promotion.discount.reserve.v1',
  confirmReservations: 'promotion.reservation.confirm.v1',
  rollbackReservations: 'promotion.reservation.rollback.v1',
  listActivePromotions: 'promotion.list-active.v1',
} as const;

export type PromotionRpcPattern =
  (typeof PROMOTION_RPC_PATTERNS)[keyof typeof PROMOTION_RPC_PATTERNS];

// ---------------------------------------------------------------------------
// Shared RPC envelope pieces
// ---------------------------------------------------------------------------

/** Stable RPC error envelope translated back to HTTP status at the caller. */
export const promotionRpcErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean().default(false),
});
export type PromotionRpcError = z.infer<typeof promotionRpcErrorSchema>;

// ---------------------------------------------------------------------------
// Value schemas (mirror IPromotionApplicationPort)
// ---------------------------------------------------------------------------

const vnd = z.number().int();

export const cartItemInputSchema = z.object({
  menuItemId: z.string().min(1),
  unitPrice: vnd.nonnegative(),
  quantity: z.number().int().positive(),
  modifiersTotal: vnd.nonnegative(),
});

export const discountPreviewParamsSchema = z.object({
  customerId: z.string().min(1),
  restaurantId: z.string().min(1),
  items: z.array(cartItemInputSchema).default([]),
  itemsSubtotal: vnd.nonnegative(),
  shippingFee: vnd.nonnegative(),
  couponCode: z.string().min(1).optional(),
});
export type DiscountPreviewParamsDto = z.infer<
  typeof discountPreviewParamsSchema
>;

export const discountReservationParamsSchema = discountPreviewParamsSchema.extend(
  {
    tempOrderId: z.string().uuid(),
  },
);
export type DiscountReservationParamsDto = z.infer<
  typeof discountReservationParamsSchema
>;

export const discountBreakdownSchema = z.object({
  promotionId: z.string(),
  promotionName: z.string(),
  discountType: z.string(),
  discountOnItems: vnd,
  discountOnShipping: vnd,
  discountAmount: vnd,
});

export const discountPreviewResultSchema = z.object({
  applicable: z.boolean(),
  promotionId: z.string().nullable(),
  couponCodeId: z.string().nullable(),
  discountAmount: vnd,
  finalItemsSubtotal: vnd,
  finalShippingFee: vnd,
  breakdown: z.array(discountBreakdownSchema),
  reason: z.string().optional(),
});
export type DiscountPreviewResultDto = z.infer<
  typeof discountPreviewResultSchema
>;

export const discountReservationResultSchema = z.object({
  reserved: z.boolean(),
  promotionId: z.string().nullable(),
  couponCodeId: z.string().nullable(),
  usageId: z.string().nullable(),
  discountAmount: vnd,
  breakdown: z.array(discountBreakdownSchema),
  reason: z.string().optional(),
});
export type DiscountReservationResultDto = z.infer<
  typeof discountReservationResultSchema
>;

// ---------------------------------------------------------------------------
// Request envelopes
// ---------------------------------------------------------------------------

export const previewDiscountRequestSchema = z.object({
  internalAuth: z.string().min(1),
  params: discountPreviewParamsSchema,
});
export type PreviewDiscountRequest = z.infer<
  typeof previewDiscountRequestSchema
>;

export const reserveDiscountRequestSchema = z.object({
  internalAuth: z.string().min(1),
  params: discountReservationParamsSchema,
});
export type ReserveDiscountRequest = z.infer<
  typeof reserveDiscountRequestSchema
>;

export const reservationByOrderRequestSchema = z.object({
  internalAuth: z.string().min(1),
  orderId: z.string().uuid(),
});
export type ReservationByOrderRequest = z.infer<
  typeof reservationByOrderRequestSchema
>;

export const listActivePromotionsRequestSchema = z.object({
  restaurantId: z.string().min(1).optional(),
});
export type ListActivePromotionsRequest = z.infer<
  typeof listActivePromotionsRequestSchema
>;

// ---------------------------------------------------------------------------
// Public read response (subset of the promotions row visible to customers)
// ---------------------------------------------------------------------------

export const publicPromotionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: z.string(),
  scope: z.string(),
  trigger: z.string(),
  discountValue: z.number().int(),
  minOrderAmount: z.number().int().nullable(),
  maxDiscountAmount: z.number().int().nullable(),
  restaurantId: z.string().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});
export type PublicPromotion = z.infer<typeof publicPromotionSchema>;

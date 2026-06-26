import type { PromotionRpcPattern } from '@uitfood/contracts';
import type { SessionAuthenticator } from '@/identity/identity.interfaces';

/**
 * Thin gateway-side Promotion RPC client. A single generic `send` keeps the
 * surface small; the HTTP controller builds the typed payload and picks the
 * pattern from PROMOTION_RPC_PATTERNS.
 */
export interface PromotionRpcGateway {
  send<T = unknown>(pattern: PromotionRpcPattern, payload: unknown): Promise<T>;
}

export interface PromotionRouteOverrides {
  promotionClient?: PromotionRpcGateway;
  promotionSessionAuthenticator?: SessionAuthenticator;
}

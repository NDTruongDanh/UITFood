import type { PaymentRpcPattern } from '@uitfood/contracts';
import type { SessionAuthenticator } from '@/identity/identity.interfaces';

export interface PaymentRpcGateway {
  send<T = unknown>(pattern: PaymentRpcPattern, payload: unknown): Promise<T>;
}

export interface PaymentRouteOverrides {
  paymentClient?: PaymentRpcGateway;
  paymentSessionAuthenticator?: SessionAuthenticator;
}

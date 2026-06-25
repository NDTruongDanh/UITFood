import type { Request } from 'express';
import type {
  IdentityHttpRequest,
  IdentityHttpResponse,
  IdentityPromoteToRestaurantRequest,
  IdentityPromoteToRestaurantResponse,
  IdentitySessionIntrospectRequest,
  IdentitySessionIntrospectResponse,
  IdentityUserContactRequest,
  IdentityUserContactResponse,
} from '@uitfood/contracts';

export interface IdentityRpcGateway {
  proxyAuthHttp(input: IdentityHttpRequest): Promise<IdentityHttpResponse>;
  introspectSession(
    input: IdentitySessionIntrospectRequest,
  ): Promise<IdentitySessionIntrospectResponse>;
  getUserContact(
    input: IdentityUserContactRequest,
  ): Promise<IdentityUserContactResponse>;
  promoteUserToRestaurant(
    input: IdentityPromoteToRestaurantRequest,
  ): Promise<IdentityPromoteToRestaurantResponse>;
}

export interface AuthenticatedGatewaySession {
  userId: string;
  roles: string[];
  email?: string | null;
  sessionId?: string | null;
}

export interface SessionAuthenticator {
  authenticate(request: Request): Promise<AuthenticatedGatewaySession | null>;
}

export interface IdentityRouteOverrides {
  identityClient?: IdentityRpcGateway;
}

export type GatewayRequestWithSession = Request & {
  gatewaySession?: AuthenticatedGatewaySession;
};

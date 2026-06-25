import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Request } from 'express';
import type {
  AuthenticatedGatewaySession,
  IdentityRpcGateway,
  SessionAuthenticator,
} from './identity.interfaces';
import { IDENTITY_RPC_GATEWAY } from './identity.tokens';

@Injectable()
export class IdentitySessionAuthenticator implements SessionAuthenticator {
  constructor(
    @Inject(IDENTITY_RPC_GATEWAY) private readonly identity: IdentityRpcGateway,
  ) {}

  async authenticate(
    request: Request,
  ): Promise<AuthenticatedGatewaySession | null> {
    const response = await this.identity.introspectSession({
      headers: authHeadersFrom(request),
      correlationId:
        typeof request.headers['x-request-id'] === 'string'
          ? request.headers['x-request-id']
          : undefined,
    });
    if (!response.authenticated || !response.user) return null;
    return {
      userId: response.user.id,
      roles: normalizeRoles(response.user.role),
      email: response.user.email ?? null,
      sessionId: response.session?.id ?? null,
    };
  }
}

function authHeadersFrom(request: Request): Record<string, string | string[]> {
  const headers: Record<string, string | string[]> = {};
  if (request.headers.cookie) headers.cookie = request.headers.cookie;
  if (request.headers.authorization) {
    headers.authorization = request.headers.authorization;
  }
  const requestId = request.headers['x-request-id'];
  if (typeof requestId === 'string') headers['x-request-id'] = requestId;
  return headers;
}

function normalizeRoles(role: string | string[] | null | undefined): string[] {
  if (Array.isArray(role)) return role;
  if (typeof role !== 'string') return [];
  return role
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

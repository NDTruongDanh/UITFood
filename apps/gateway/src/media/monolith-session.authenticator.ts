import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env } from '@/config/env.schema';
import type {
  AuthenticatedGatewaySession,
  SessionAuthenticator,
} from '@/identity/identity.interfaces';

@Injectable()
export class MonolithSessionAuthenticator implements SessionAuthenticator {
  constructor(private readonly config: ConfigService<Env, true>) {}

  async authenticate(
    request: Request,
  ): Promise<AuthenticatedGatewaySession | null> {
    const upstream = this.config.get('MONOLITH_UPSTREAM_URL', { infer: true });
    const timeoutMs = this.config.get('GATEWAY_AUTH_TIMEOUT_MS', {
      infer: true,
    });
    const headers: Record<string, string> = {};
    if (request.headers.cookie) headers.cookie = request.headers.cookie;
    if (request.headers.authorization) {
      headers.authorization = request.headers.authorization;
    }
    const requestId = request.headers['x-request-id'];
    if (typeof requestId === 'string') headers['x-request-id'] = requestId;

    let response: Response;
    try {
      response = await fetch(new URL('/api/auth/get-session', upstream), {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        'Identity session verification is unavailable.',
        { cause: error },
      );
    }

    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Identity session verification is unavailable.',
      );
    }

    const body = (await response.json().catch(() => null)) as unknown;
    if (!body || typeof body !== 'object') return null;
    const session = body as Record<string, unknown>;
    if (!session.user || !session.session) return null;
    const user = session.user as Record<string, unknown>;
    const sessionRecord = session.session as Record<string, unknown>;
    return {
      userId: String(user.id),
      roles: normalizeRoles(user.role),
      email: typeof user.email === 'string' ? user.email : null,
      sessionId: typeof sessionRecord.id === 'string' ? sessionRecord.id : null,
    };
  }
}

function normalizeRoles(role: unknown): string[] {
  if (Array.isArray(role)) {
    return role.filter((item): item is string => typeof item === 'string');
  }
  if (typeof role !== 'string') return [];
  return role
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

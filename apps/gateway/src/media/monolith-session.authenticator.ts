import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env } from '@/config/env.schema';
import type { SessionAuthenticator } from './media.interfaces';

@Injectable()
export class MonolithSessionAuthenticator implements SessionAuthenticator {
  constructor(private readonly config: ConfigService<Env, true>) {}

  async isAuthenticated(request: Request): Promise<boolean> {
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

    if (response.status === 401 || response.status === 403) return false;
    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Identity session verification is unavailable.',
      );
    }

    const body = (await response.json().catch(() => null)) as unknown;
    if (!body || typeof body !== 'object') return false;
    const session = body as Record<string, unknown>;
    return Boolean(session.user && session.session);
  }
}

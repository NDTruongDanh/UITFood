import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { signInternalJwt } from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';
import type { GatewayRequestWithSession } from './identity.interfaces';

@Injectable()
export class InternalJwtService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  issueForRequest(
    request: GatewayRequestWithSession,
    audience: string,
  ): string {
    if (!request.gatewaySession) {
      throw new Error('Cannot issue an internal JWT without a gateway session.');
    }
    return signInternalJwt({
      issuer: this.config.get('INTERNAL_AUTH_JWT_ISSUER', { infer: true }),
      audience,
      secret: this.config.get('INTERNAL_AUTH_JWT_SECRET', { infer: true }),
      subject: request.gatewaySession.userId,
      roles: request.gatewaySession.roles,
      email: request.gatewaySession.email,
      sessionId: request.gatewaySession.sessionId,
      correlationId:
        typeof request.headers['x-request-id'] === 'string'
          ? request.headers['x-request-id']
          : randomUUID(),
      ttlSeconds: this.config.get('INTERNAL_AUTH_JWT_TTL_SECONDS', {
        infer: true,
      }),
    });
  }
}

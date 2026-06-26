import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InternalJwtError,
  verifyInternalJwt,
  type InternalAuthClaims,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';

export interface ReportingCaller {
  userId: string;
  roles: string[];
  isAdmin: boolean;
}

/**
 * Verifies the gateway-issued internal JWT carried on the analytics RPC reads and
 * returns the caller (subject + roles). Reporting re-checks the admin role in the
 * RPC handlers; it never trusts raw identity headers.
 */
@Injectable()
export class InternalAuthService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  verifyReportingToken(token: string): ReportingCaller {
    try {
      const claims: InternalAuthClaims = verifyInternalJwt(token, {
        audience: 'reporting',
        secret: this.config.get('INTERNAL_AUTH_JWT_SECRET', { infer: true }),
        issuers: this.config
          .get('INTERNAL_AUTH_TRUSTED_ISSUERS', { infer: true })
          .split(',')
          .map((issuer) => issuer.trim())
          .filter(Boolean),
      });
      const roles = claims.roles ?? [];
      return { userId: claims.sub, roles, isAdmin: roles.includes('admin') };
    } catch (error) {
      if (error instanceof InternalJwtError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }
}

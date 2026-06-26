import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  GatewayRequestWithSession,
  SessionAuthenticator,
} from '@/identity/identity.interfaces';
import { REPORTING_SESSION_AUTHENTICATOR } from './reporting.tokens';

/**
 * Authenticates the incoming session for Reporting routes and attaches it to the
 * request so InternalJwtService can mint an `aud=reporting` token. Reporting
 * re-checks the admin role in its RPC handler.
 */
@Injectable()
export class ReportingSessionGuard implements CanActivate {
  constructor(
    @Inject(REPORTING_SESSION_AUTHENTICATOR)
    private readonly authenticator: SessionAuthenticator,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<GatewayRequestWithSession>();
    const session = await this.authenticator.authenticate(request);
    if (session) {
      request.gatewaySession = session;
      return true;
    }
    throw new UnauthorizedException('Authentication required.');
  }
}

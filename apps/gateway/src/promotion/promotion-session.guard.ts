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
import { PROMOTION_SESSION_AUTHENTICATOR } from './promotion.tokens';

/**
 * Authenticates the incoming session for the Promotion preview/validate routes
 * and attaches it to the request so InternalJwtService can mint a
 * 'promotion'-audience token carrying the customer id.
 */
@Injectable()
export class PromotionSessionGuard implements CanActivate {
  constructor(
    @Inject(PROMOTION_SESSION_AUTHENTICATOR)
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

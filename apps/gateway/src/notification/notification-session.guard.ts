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
import { NOTIFICATION_SESSION_AUTHENTICATOR } from './notification.tokens';

@Injectable()
export class NotificationSessionGuard implements CanActivate {
  constructor(
    @Inject(NOTIFICATION_SESSION_AUTHENTICATOR)
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

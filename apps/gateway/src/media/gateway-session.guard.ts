import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { SessionAuthenticator } from './media.interfaces';
import { SESSION_AUTHENTICATOR } from './media.tokens';

@Injectable()
export class GatewaySessionGuard implements CanActivate {
  constructor(
    @Inject(SESSION_AUTHENTICATOR)
    private readonly authenticator: SessionAuthenticator,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (await this.authenticator.isAuthenticated(request)) return true;
    throw new UnauthorizedException('Authentication required.');
  }
}

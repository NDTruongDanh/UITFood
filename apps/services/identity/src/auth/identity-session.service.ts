import { Inject, Injectable } from '@nestjs/common';
import {
  identitySessionIntrospectRequestSchema,
  type IdentitySessionIntrospectRequest,
  type IdentitySessionIntrospectResponse,
} from '@uitfood/contracts';
import { IDENTITY_AUTH, type IdentityAuth } from './auth.factory';

@Injectable()
export class IdentitySessionService {
  constructor(@Inject(IDENTITY_AUTH) private readonly auth: IdentityAuth) {}

  async introspect(
    input: IdentitySessionIntrospectRequest,
  ): Promise<IdentitySessionIntrospectResponse> {
    const request = identitySessionIntrospectRequestSchema.parse(input);
    const session = await this.auth.api.getSession({
      headers: toHeaders(request.headers),
    });

    if (!session) {
      return { authenticated: false, user: null, session: null };
    }

    const user = session.user as Record<string, unknown>;
    const sessionRecord = session.session as Record<string, unknown>;
    const expiresAt = sessionRecord.expiresAt;
    return {
      authenticated: true,
      user: {
        id: String(user.id),
        email: typeof user.email === 'string' ? user.email : null,
        role:
          typeof user.role === 'string' || Array.isArray(user.role)
            ? (user.role as string | string[])
            : null,
      },
      session: {
        ...(typeof sessionRecord.id === 'string'
          ? { id: sessionRecord.id }
          : {}),
        ...(expiresAt instanceof Date
          ? { expiresAt: expiresAt.toISOString() }
          : typeof expiresAt === 'string'
            ? { expiresAt }
            : {}),
      },
    };
  }
}

function toHeaders(
  headers: IdentitySessionIntrospectRequest['headers'],
): Headers {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) result.append(key, item);
      continue;
    }
    result.set(key, value);
  }
  return result;
}

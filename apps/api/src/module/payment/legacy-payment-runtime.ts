import {
  CanActivate,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env.schema';

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return ['1', 'true', 'yes'].includes(raw.trim().toLowerCase());
}

export function legacyPaymentRuntimeEnabled(): boolean {
  return envFlag('LEGACY_PAYMENT_RUNTIME_ENABLED', true);
}

@Injectable()
export class LegacyPaymentRouteGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(): boolean {
    if (this.config.get('LEGACY_PAYMENT_ROUTES_ENABLED', { infer: true })) {
      return true;
    }
    throw new ServiceUnavailableException(
      'Legacy Payment routes are disabled after cutover.',
    );
  }
}

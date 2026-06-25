import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';

/**
 * Gateway management endpoints. These are the only routes the gateway serves
 * itself; everything else is proxied (see api-proxy.factory.ts pathFilter).
 */
@Controller()
export class HealthController {
  constructor(private readonly config: ConfigService<Env, true>) {}

  /** Liveness: the process is up. Used by the orchestrator to restart on hang. */
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /**
   * Readiness follows active route ownership. The monolith must always be
   * reachable, and Media must be ready after its route cutover is enabled.
   * A non-2xx HTTP response from the monolith still counts as
   * "reachable" — only a transport failure/timeout fails readiness.
   */
  @Get('ready')
  async ready(): Promise<{
    status: 'ok';
    upstream: 'reachable';
    media: 'reachable' | 'disabled';
    identity: 'reachable' | 'disabled';
  }> {
    const target = this.config.get('MONOLITH_UPSTREAM_URL', { infer: true });
    const mediaEnabled = this.config.get('MEDIA_ROUTES_ENABLED', {
      infer: true,
    });
    const identityEnabled = this.config.get('IDENTITY_ROUTES_ENABLED', {
      infer: true,
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_000);
    try {
      const [upstreamResult, mediaResult, identityResult] =
        await Promise.allSettled([
        fetch(target, { method: 'HEAD', signal: controller.signal }),
        mediaEnabled
          ? this.checkMediaReadiness(controller.signal)
          : Promise.resolve(),
        identityEnabled
          ? this.checkIdentityReadiness(controller.signal)
          : Promise.resolve(),
      ]);
      if (
        upstreamResult.status === 'rejected' ||
        mediaResult.status === 'rejected' ||
        identityResult.status === 'rejected'
      ) {
        throw new ServiceUnavailableException({
          status: 'degraded',
          upstream:
            upstreamResult.status === 'fulfilled' ? 'reachable' : 'unreachable',
          media: !mediaEnabled
            ? 'disabled'
            : mediaResult.status === 'fulfilled'
              ? 'reachable'
              : 'unreachable',
          identity: !identityEnabled
            ? 'disabled'
            : identityResult.status === 'fulfilled'
              ? 'reachable'
              : 'unreachable',
        });
      }
      return {
        status: 'ok',
        upstream: 'reachable',
        media: mediaEnabled ? 'reachable' : 'disabled',
        identity: identityEnabled ? 'reachable' : 'disabled',
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException({ status: 'degraded' });
    } finally {
      clearTimeout(timer);
    }
  }

  private async checkMediaReadiness(signal: AbortSignal): Promise<void> {
    const host = this.config.get('MEDIA_TCP_HOST', { infer: true });
    const port = this.config.get('MEDIA_MANAGEMENT_PORT', { infer: true });
    const response = await fetch(`http://${host}:${port}/ready`, {
      method: 'GET',
      signal,
    });
    if (!response.ok) throw new Error('Media is not ready');
  }

  private async checkIdentityReadiness(signal: AbortSignal): Promise<void> {
    const host = this.config.get('IDENTITY_TCP_HOST', { infer: true });
    const port = this.config.get('IDENTITY_MANAGEMENT_PORT', { infer: true });
    const response = await fetch(`http://${host}:${port}/ready`, {
      method: 'GET',
      signal,
    });
    if (!response.ok) throw new Error('Identity is not ready');
  }
}

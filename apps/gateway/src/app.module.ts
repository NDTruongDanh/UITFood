import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.schema';
import { HealthModule } from './health/health.module';
import { IdentityRoutesModule } from './identity/identity-routes.module';
import type { IdentityRouteOverrides } from './identity/identity.interfaces';
import { MediaRoutesModule } from './media/media-routes.module';
import type { MediaRouteOverrides } from './media/media.interfaces';
import { NotificationRoutesModule } from './notification/notification-routes.module';
import type { NotificationRouteOverrides } from './notification/notification.interfaces';

/**
 * Gateway root module.
 *
 * Deliberately minimal: validated config + health endpoints. The reverse proxy
 * itself is wired in main.ts (it must run as raw Express middleware before body
 * parsing and needs the http.Server for WebSocket upgrades).
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate }), HealthModule],
})
export class AppModule {
  static register(
    overrides: MediaRouteOverrides &
      IdentityRouteOverrides &
      NotificationRouteOverrides = {},
  ): DynamicModule {
    return {
      module: AppModule,
      imports: [
        IdentityRoutesModule.register(overrides),
        MediaRoutesModule.register(overrides),
        NotificationRoutesModule.register(overrides),
      ],
    };
  }
}

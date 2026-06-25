import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import type { Env } from '@/config/env.schema';
import type { IdentityRouteOverrides } from './identity.interfaces';
import { IdentityHttpProxyService } from './identity-http-proxy.service';
import { IdentitySessionAuthenticator } from './identity-session.authenticator';
import { InternalJwtService } from './internal-jwt.service';
import { NestIdentityRpcClient } from './nest-identity-rpc.client';
import { IDENTITY_RPC_GATEWAY, IDENTITY_TCP_CLIENT } from './identity.tokens';

@Global()
@Module({})
export class IdentityRoutesModule {
  static register(overrides: IdentityRouteOverrides = {}): DynamicModule {
    return {
      module: IdentityRoutesModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: IDENTITY_TCP_CLIENT,
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) =>
            ClientProxyFactory.create({
              transport: Transport.TCP,
              options: {
                host: config.get('IDENTITY_TCP_HOST', { infer: true }),
                port: config.get('IDENTITY_TCP_PORT', { infer: true }),
              },
            }),
        },
        NestIdentityRpcClient,
        IdentityHttpProxyService,
        IdentitySessionAuthenticator,
        InternalJwtService,
        overrides.identityClient
          ? { provide: IDENTITY_RPC_GATEWAY, useValue: overrides.identityClient }
          : { provide: IDENTITY_RPC_GATEWAY, useExisting: NestIdentityRpcClient },
      ],
      exports: [
        IDENTITY_RPC_GATEWAY,
        IdentityHttpProxyService,
        IdentitySessionAuthenticator,
        InternalJwtService,
      ],
      global: true,
    };
  }
}

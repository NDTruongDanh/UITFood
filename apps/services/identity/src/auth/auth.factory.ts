import { randomUUID } from 'crypto';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, bearer, openAPI, phoneNumber } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';
import type { Env } from '@/config/env.schema';
import type { IdentityDatabase } from '@/drizzle/database.module';
import * as schema from './auth.schema';
import type { IdentityEventPublisher } from './identity-event.publisher';

export const APP_ROLES = ['admin', 'restaurant', 'shipper', 'user'] as const;
export type AppRole = (typeof APP_ROLES)[number];
export const IDENTITY_AUTH = Symbol('IDENTITY_AUTH');
export type IdentityAuth = ReturnType<typeof betterAuth>;

export function createIdentityAuth(
  db: IdentityDatabase,
  env: Env,
  events: IdentityEventPublisher,
): IdentityAuth {
  const isProduction = env.NODE_ENV === 'production';

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
    },
    trustedOrigins: [
      'http://localhost:5173',
      'http://localhost:5174',
      'uitfood://',
      'exp://**',
      'https://uitfood-web.onrender.com',
      'https://uitfood-admin.onrender.com',
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (createdUser) => {
            await events.publishContactChanged(createdUser);
            await events.publishRoleChanged(createdUser);
          },
        },
        update: {
          after: async (updatedUser) => {
            await events.publishContactChanged(updatedUser);
            await events.publishRoleChanged(updatedUser);
          },
        },
      },
    },
    plugins: [
      openAPI(),
      bearer(),
      admin({
        defaultRole: 'user',
        adminRoles: ['admin'],
      }),
      phoneNumber({
        sendOTP: ({ phoneNumber, code }) => {
          // Replace with an SMS provider before enabling phone OTP in production.
          console.log(`[AUTH] Sending OTP ${code} to ${phoneNumber}`);
        },
      }),
      expo(),
    ],
    advanced: {
      ...(isProduction
        ? {
            defaultCookieAttributes: {
              sameSite: 'none',
              secure: true,
              partitioned: true,
            } as const,
            useSecureCookies: true,
          }
        : {}),
      database: {
        generateId: () => randomUUID(),
      },
    },
  }) as unknown as IdentityAuth;
}

import {
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import {
  NOTIFICATION_RPC_PATTERNS,
  markAllReadResponseSchema,
  markReadResponseSchema,
  notificationInboxResponseSchema,
  notificationPreferenceResponseSchema,
  notificationRpcErrorSchema,
  pushTokenListResponseSchema,
  registerPushTokenResponseSchema,
  removePushTokenResponseSchema,
  testEmailResponseSchema,
  testPushResponseSchema,
  unreadCountResponseSchema,
  type GetNotificationInboxRequest,
  type MarkNotificationReadRequest,
  type NotificationUserRequest,
  type RegisterPushTokenRequest,
  type RemovePushTokenRequest,
  type TestEmailRequest,
  type TestPushRequest,
  type UpdateNotificationPreferencesRequest,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';
import type { NotificationRpcGateway } from './notification.interfaces';
import { NOTIFICATION_TCP_CLIENT } from './notification.tokens';

@Injectable()
export class NestNotificationRpcClient
  implements NotificationRpcGateway, OnApplicationShutdown
{
  constructor(
    @Inject(NOTIFICATION_TCP_CLIENT) private readonly client: ClientProxy,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }

  async getInbox(input: GetNotificationInboxRequest) {
    return notificationInboxResponseSchema.parse(
      await this.send(NOTIFICATION_RPC_PATTERNS.getInbox, input),
    );
  }

  async getUnreadCount(input: NotificationUserRequest) {
    return unreadCountResponseSchema.parse(
      await this.send(NOTIFICATION_RPC_PATTERNS.getUnreadCount, input),
    );
  }

  async markAllRead(input: NotificationUserRequest) {
    return markAllReadResponseSchema.parse(
      await this.send(NOTIFICATION_RPC_PATTERNS.markAllRead, input),
    );
  }

  async markRead(input: MarkNotificationReadRequest) {
    return markReadResponseSchema.parse(
      await this.send(NOTIFICATION_RPC_PATTERNS.markRead, input),
    );
  }

  async getPreferences(input: NotificationUserRequest) {
    return notificationPreferenceResponseSchema.parse(
      await this.send(NOTIFICATION_RPC_PATTERNS.getPreferences, input),
    );
  }

  async updatePreferences(input: UpdateNotificationPreferencesRequest) {
    return notificationPreferenceResponseSchema.parse(
      await this.send(NOTIFICATION_RPC_PATTERNS.updatePreferences, input),
    );
  }

  async listPushTokens(input: NotificationUserRequest) {
    return pushTokenListResponseSchema.parse(
      await this.send(NOTIFICATION_RPC_PATTERNS.listPushTokens, input),
    );
  }

  async registerPushToken(input: RegisterPushTokenRequest) {
    return registerPushTokenResponseSchema.parse(
      await this.send(NOTIFICATION_RPC_PATTERNS.registerPushToken, input),
    );
  }

  async removePushToken(input: RemovePushTokenRequest) {
    return removePushTokenResponseSchema.parse(
      await this.send(NOTIFICATION_RPC_PATTERNS.removePushToken, input),
    );
  }

  async sendTestPush(input: TestPushRequest) {
    return testPushResponseSchema.parse(
      await this.send(NOTIFICATION_RPC_PATTERNS.testPush, input),
    );
  }

  async sendTestEmail(input: TestEmailRequest) {
    return testEmailResponseSchema.parse(
      await this.send(NOTIFICATION_RPC_PATTERNS.testEmail, input),
    );
  }

  private async send(pattern: string, payload: unknown): Promise<unknown> {
    const timeoutMs = this.config.get('NOTIFICATION_RPC_TIMEOUT_MS', {
      infer: true,
    });
    try {
      return await firstValueFrom(
        this.client.send(pattern, payload).pipe(timeout(timeoutMs)),
      );
    } catch (error) {
      const rpcError = notificationRpcErrorSchema.safeParse(error);
      if (rpcError.success) {
        throw new HttpException(
          {
            statusCode: rpcError.data.statusCode,
            error: HttpStatus[rpcError.data.statusCode],
            message: rpcError.data.message,
          },
          rpcError.data.statusCode,
        );
      }
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException(
          'Notification service request timed out.',
        );
      }
      throw new ServiceUnavailableException(
        'Notification service is unavailable.',
        { cause: error },
      );
    }
  }
}

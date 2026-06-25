import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalJwtService } from '@/identity/internal-jwt.service';
import type { GatewayRequestWithSession } from '@/identity/identity.interfaces';
import type { Env } from '@/config/env.schema';
import {
  notificationInboxQuerySchema,
  registerPushTokenSchema,
  removePushTokenSchema,
  testEmailSchema,
  testPushSchema,
  updateNotificationPreferenceSchema,
} from '@uitfood/contracts';
import type { NotificationRpcGateway } from './notification.interfaces';
import { NotificationSessionGuard } from './notification-session.guard';
import { NOTIFICATION_RPC_GATEWAY } from './notification.tokens';

@Controller('api/notifications')
export class NotificationController {
  constructor(
    @Inject(NOTIFICATION_RPC_GATEWAY)
    private readonly notifications: NotificationRpcGateway,
    private readonly internalJwt: InternalJwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get('my')
  @UseGuards(NotificationSessionGuard)
  getInbox(
    @Req() request: GatewayRequestWithSession,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.notifications.getInbox({
      internalAuth: this.issue(request),
      query: notificationInboxQuerySchema.parse({
        unreadOnly:
          query.unreadOnly === undefined
            ? undefined
            : ['1', 'true', 'yes'].includes(query.unreadOnly.toLowerCase()),
        type: query.type,
        limit: query.limit === undefined ? undefined : Number(query.limit),
        offset: query.offset === undefined ? undefined : Number(query.offset),
      }),
    });
  }

  @Get('my/unread-count')
  @UseGuards(NotificationSessionGuard)
  getUnreadCount(@Req() request: GatewayRequestWithSession) {
    return this.notifications.getUnreadCount({ internalAuth: this.issue(request) });
  }

  @Patch('my/read-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(NotificationSessionGuard)
  markAllRead(@Req() request: GatewayRequestWithSession) {
    return this.notifications.markAllRead({ internalAuth: this.issue(request) });
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @UseGuards(NotificationSessionGuard)
  markRead(
    @Req() request: GatewayRequestWithSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead({
      internalAuth: this.issue(request),
      notificationId: id,
    });
  }

  @Get('my/preferences')
  @UseGuards(NotificationSessionGuard)
  getPreferences(@Req() request: GatewayRequestWithSession) {
    return this.notifications.getPreferences({ internalAuth: this.issue(request) });
  }

  @Patch('my/preferences')
  @HttpCode(HttpStatus.OK)
  @UseGuards(NotificationSessionGuard)
  updatePreferences(
    @Req() request: GatewayRequestWithSession,
    @Body() body: unknown,
  ) {
    return this.notifications.updatePreferences({
      internalAuth: this.issue(request),
      preferences: updateNotificationPreferenceSchema.parse(body),
    });
  }

  @Get('my/push-tokens')
  @UseGuards(NotificationSessionGuard)
  listPushTokens(@Req() request: GatewayRequestWithSession) {
    return this.notifications.listPushTokens({ internalAuth: this.issue(request) });
  }

  @Post('my/push-tokens')
  @HttpCode(HttpStatus.OK)
  @UseGuards(NotificationSessionGuard)
  registerPushToken(
    @Req() request: GatewayRequestWithSession,
    @Body() body: unknown,
  ) {
    return this.notifications.registerPushToken({
      internalAuth: this.issue(request),
      token: registerPushTokenSchema.parse(body),
    });
  }

  @Delete('my/push-tokens')
  @HttpCode(HttpStatus.OK)
  @UseGuards(NotificationSessionGuard)
  removePushToken(
    @Req() request: GatewayRequestWithSession,
    @Body() body: unknown,
  ) {
    return this.notifications.removePushToken({
      internalAuth: this.issue(request),
      token: removePushTokenSchema.parse(body),
    });
  }

  @Post('test/push')
  @HttpCode(HttpStatus.OK)
  sendTestPush(@Body() body: unknown) {
    this.assertDevOrTest();
    return this.notifications.sendTestPush({
      push: testPushSchema.parse(body),
    });
  }

  @Post('test/email')
  @HttpCode(HttpStatus.OK)
  sendTestEmail(@Body() body: unknown) {
    this.assertDevOrTest();
    return this.notifications.sendTestEmail({
      email: testEmailSchema.parse(body),
    });
  }

  private issue(request: GatewayRequestWithSession): string {
    return this.internalJwt.issueForRequest(request, 'notification');
  }

  private assertDevOrTest(): void {
    const nodeEnv = this.config.get('NODE_ENV', { infer: true });
    if (nodeEnv !== 'development' && nodeEnv !== 'test') {
      throw new NotFoundException();
    }
  }
}

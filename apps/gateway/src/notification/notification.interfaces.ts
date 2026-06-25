import type { SessionAuthenticator } from '@/identity/identity.interfaces';
import type {
  GetNotificationInboxRequest,
  MarkAllReadResponse,
  MarkNotificationReadRequest,
  MarkReadResponse,
  NotificationInboxResponse,
  NotificationPreferenceResponse,
  NotificationUserRequest,
  PushTokenListResponse,
  RegisterPushTokenRequest,
  RegisterPushTokenResponse,
  RemovePushTokenRequest,
  RemovePushTokenResponse,
  TestEmailRequest,
  TestEmailResponse,
  TestPushRequest,
  TestPushResponse,
  UnreadCountResponse,
  UpdateNotificationPreferencesRequest,
} from '@uitfood/contracts';

export interface NotificationRpcGateway {
  getInbox(
    input: GetNotificationInboxRequest,
  ): Promise<NotificationInboxResponse>;
  getUnreadCount(input: NotificationUserRequest): Promise<UnreadCountResponse>;
  markAllRead(input: NotificationUserRequest): Promise<MarkAllReadResponse>;
  markRead(input: MarkNotificationReadRequest): Promise<MarkReadResponse>;
  getPreferences(
    input: NotificationUserRequest,
  ): Promise<NotificationPreferenceResponse>;
  updatePreferences(
    input: UpdateNotificationPreferencesRequest,
  ): Promise<NotificationPreferenceResponse>;
  listPushTokens(input: NotificationUserRequest): Promise<PushTokenListResponse>;
  registerPushToken(
    input: RegisterPushTokenRequest,
  ): Promise<RegisterPushTokenResponse>;
  removePushToken(
    input: RemovePushTokenRequest,
  ): Promise<RemovePushTokenResponse>;
  sendTestPush(input: TestPushRequest): Promise<TestPushResponse>;
  sendTestEmail(input: TestEmailRequest): Promise<TestEmailResponse>;
}

export interface NotificationRouteOverrides {
  notificationClient?: NotificationRpcGateway;
  notificationSessionAuthenticator?: SessionAuthenticator;
}

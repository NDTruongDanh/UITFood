import type { ReportingRpcPattern } from '@uitfood/contracts';
import type { SessionAuthenticator } from '@/identity/identity.interfaces';

export interface ReportingRpcGateway {
  send<T = unknown>(pattern: ReportingRpcPattern, payload: unknown): Promise<T>;
}

export interface ReportingRouteOverrides {
  reportingClient?: ReportingRpcGateway;
  reportingSessionAuthenticator?: SessionAuthenticator;
}

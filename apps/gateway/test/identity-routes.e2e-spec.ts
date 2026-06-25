import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { IdentityRpcGateway } from '../src/identity/identity.interfaces';
import { createGatewayApp } from '../src/gateway.factory';

function startUpstream(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ upstream: 'monolith' }));
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: (server.address() as AddressInfo).port });
    });
  });
}

describe('Gateway Identity route cutover', () => {
  let upstream: http.Server;
  let app: INestApplication;
  let client: ReturnType<typeof request>;

  const identityClient: IdentityRpcGateway = {
    proxyAuthHttp: jest.fn().mockResolvedValue({
      status: 200,
      headers: {
        'content-type': 'application/json',
        'set-cookie': [
          'better-auth.session_token=abc; Path=/; HttpOnly',
          'better-auth.session_data=def; Path=/; HttpOnly',
        ],
      },
      bodyBase64: Buffer.from(JSON.stringify({ ok: true })).toString('base64'),
    }),
    introspectSession: jest.fn().mockResolvedValue({
      authenticated: true,
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
      session: { id: 'session-1' },
    }),
    getUserContact: jest.fn(),
    promoteUserToRestaurant: jest.fn(),
  };

  beforeAll(async () => {
    const started = await startUpstream();
    upstream = started.server;
    const built = await createGatewayApp({
      target: `http://127.0.0.1:${started.port}`,
      proxyTimeoutMs: 5000,
      identityRoutesEnabled: true,
      identityClient,
    });
    app = built.app;
    await app.init();
    client = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  });

  beforeEach(() => jest.clearAllMocks());

  it('GW-IDENTITY-01 sends auth requests to Identity RPC and preserves cookies', async () => {
    const response = await client
      .post('/api/auth/sign-in/email?redirect=false')
      .set('cookie', 'existing=1')
      .set('x-internal-jwt', 'forged')
      .send({ email: 'user@example.com', password: 'secret' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.headers['set-cookie']).toEqual([
      'better-auth.session_token=abc; Path=/; HttpOnly',
      'better-auth.session_data=def; Path=/; HttpOnly',
    ]);
    expect(identityClient.proxyAuthHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: expect.stringContaining(
          '/api/auth/sign-in/email?redirect=false',
        ),
        headers: expect.not.objectContaining({ 'x-internal-jwt': 'forged' }),
        bodyBase64: expect.any(String),
      }),
    );
  });

  it('GW-IDENTITY-02 keeps unrelated routes on the monolith proxy', async () => {
    const response = await client.get('/api/restaurants');

    expect(response.body).toEqual({ upstream: 'monolith' });
    expect(identityClient.proxyAuthHttp).not.toHaveBeenCalled();
  });
});

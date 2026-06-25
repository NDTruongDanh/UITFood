import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHash } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { MediaRpcGateway } from '../src/media/media.interfaces';
import { createGatewayApp } from '../src/gateway.factory';

function startUpstream(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      if (req.url === '/api/auth/get-session') {
        res.end(
          req.headers.authorization === 'Bearer valid'
            ? JSON.stringify({ user: { id: 'user-1' }, session: { id: 's-1' } })
            : 'null',
        );
        return;
      }
      res.end(JSON.stringify({ upstream: 'monolith' }));
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: (server.address() as AddressInfo).port });
    });
  });
}

describe('Gateway Media route cutover', () => {
  let upstream: http.Server;
  let app: INestApplication;
  let client: ReturnType<typeof request>;

  const image = {
    id: '00000000-0000-4000-8000-000000000001',
    publicId: 'menu/example',
    secureUrl: 'https://res.cloudinary.com/demo/image/upload/example.jpg',
    width: 800,
    height: 600,
    createdAt: '2026-06-24T12:00:00.000Z',
  };
  const mediaClient: MediaRpcGateway = {
    listImages: jest.fn().mockResolvedValue({ data: [image], total: 1 }),
    createImage: jest.fn().mockResolvedValue(image),
    createUploadSignature: jest.fn().mockResolvedValue({
      cloudName: 'demo',
      apiKey: 'key',
      timestamp: 1715279900,
      signature: 'signed',
      folder: 'menu-items',
    }),
  };
  beforeAll(async () => {
    const started = await startUpstream();
    upstream = started.server;
    const built = await createGatewayApp({
      target: `http://127.0.0.1:${started.port}`,
      proxyTimeoutMs: 5000,
      mediaRoutesEnabled: true,
      mediaClient,
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

  it('GW-MEDIA-01 serves public image reads through Media RPC', async () => {
    const response = await client.get('/api/images?offset=0&limit=20');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [image], total: 1 });
    expect(mediaClient.listImages).toHaveBeenCalledWith({
      offset: 0,
      limit: 20,
    });
  });

  it('GW-MEDIA-02 preserves authentication on image writes', async () => {
    const unauthorized = await client.post('/api/images').send({
      publicId: image.publicId,
      secureUrl: image.secureUrl,
      width: image.width,
      height: image.height,
    });
    expect(unauthorized.status).toBe(401);

    const authorized = await client
      .post('/api/images')
      .set('authorization', 'Bearer valid')
      .send({
        publicId: image.publicId,
        secureUrl: image.secureUrl,
        width: image.width,
        height: image.height,
      });

    expect(authorized.status).toBe(201);
    expect(mediaClient.createImage).toHaveBeenCalledWith({
      internalAuth: expect.any(String),
      idempotencyKey: `image:${createHash('sha256')
        .update(image.publicId)
        .digest('hex')}`,
      image: expect.objectContaining({ publicId: image.publicId }),
    });
  });

  it('GW-MEDIA-03 routes authenticated signature requests to Media', async () => {
    const response = await client
      .get('/api/cloudinary/signature?folder=menu-items')
      .set('authorization', 'Bearer valid');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({ folder: 'menu-items', signature: 'signed' }),
    );
    expect(mediaClient.createUploadSignature).toHaveBeenCalledWith({
      internalAuth: expect.any(String),
      folder: 'menu-items',
    });
  });

  it('GW-MEDIA-04 keeps unrelated routes on the monolith proxy', async () => {
    const response = await client.get('/api/restaurants');
    expect(response.body).toEqual({ upstream: 'monolith' });
  });

  it('GW-MEDIA-05 handles browser CORS preflight locally', async () => {
    const response = await client
      .options('/api/images')
      .set('origin', 'http://localhost:5173')
      .set('access-control-request-method', 'POST');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});

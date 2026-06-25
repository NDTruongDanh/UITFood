import { Inject, Injectable, Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { IdentityRpcGateway } from './identity.interfaces';
import { IDENTITY_RPC_GATEWAY } from './identity.tokens';

const MAX_AUTH_BODY_BYTES = 2 * 1024 * 1024;

@Injectable()
export class IdentityHttpProxyService {
  private readonly logger = new Logger(IdentityHttpProxyService.name);

  constructor(
    @Inject(IDENTITY_RPC_GATEWAY) private readonly identity: IdentityRpcGateway,
  ) {}

  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = await readBody(req);
      const protocol =
        typeof req.headers['x-forwarded-proto'] === 'string'
          ? req.headers['x-forwarded-proto'].split(',')[0]
          : req.protocol;
      const host =
        typeof req.headers['x-forwarded-host'] === 'string'
          ? req.headers['x-forwarded-host'].split(',')[0]
          : req.headers.host;
      const url = `${protocol}://${host}${req.originalUrl}`;
      const response = await this.identity.proxyAuthHttp({
        method: req.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS',
        url,
        headers: headersFrom(req),
        bodyBase64: body.length ? body.toString('base64') : undefined,
      });

      for (const [name, value] of Object.entries(response.headers)) {
        res.setHeader(name, value);
      }
      res.status(response.status).end(Buffer.from(response.bodyBase64, 'base64'));
    } catch (error) {
      this.logger.error(
        `Identity auth proxy failed for ${req.method} ${req.originalUrl}: ${
          (error as Error).message
        }`,
      );
      next(error);
    }
  }
}

function headersFrom(req: Request): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string' || Array.isArray(value)) result[key] = value;
  }
  return result;
}

function readBody(req: Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_AUTH_BODY_BYTES) {
        reject(new Error('Auth request body exceeds 2MB.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

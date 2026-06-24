import type { NextFunction, Request, Response } from 'express';
import { isMediaPublicRoute } from '../proxy/api-proxy.factory';

export function createMediaCors(allowedOrigins: ReadonlySet<string>) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!isMediaPublicRoute(request.path)) {
      next();
      return;
    }

    const origin = request.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      response.setHeader(
        'Access-Control-Allow-Headers',
        'Authorization,Content-Type,Idempotency-Key,X-Request-Id',
      );
    }

    if (request.method === 'OPTIONS') {
      response.status(204).end();
      return;
    }
    next();
  };
}

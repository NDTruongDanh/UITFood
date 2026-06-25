import { HttpException, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ZodError } from 'zod';

/**
 * Maps any thrown error to the stable Catalog RPC error envelope. The gateway
 * translates this back to an HTTP status/code.
 */
export function asCatalogRpcException(error: unknown): RpcException {
  if (error instanceof RpcException) return error;

  const statusCode =
    error instanceof ZodError
      ? HttpStatus.BAD_REQUEST
      : error instanceof HttpException
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
  const message =
    error instanceof ZodError
      ? 'Invalid Catalog RPC payload.'
      : error instanceof Error
        ? error.message
        : 'Catalog service request failed.';

  return new RpcException({
    statusCode,
    code: `CATALOG_${HttpStatus[statusCode] ?? 'ERROR'}`,
    message,
    retryable: statusCode >= 500,
  });
}

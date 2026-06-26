import { HttpException, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ZodError } from 'zod';

/**
 * Maps any thrown error to the stable Reporting RPC error envelope. The gateway
 * translates this back to an HTTP status/code.
 */
export function asReportingRpcException(error: unknown): RpcException {
  if (error instanceof RpcException) return error;

  const statusCode =
    error instanceof ZodError
      ? HttpStatus.BAD_REQUEST
      : error instanceof HttpException
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
  const message =
    error instanceof ZodError
      ? 'Invalid Reporting RPC payload.'
      : error instanceof Error
        ? error.message
        : 'Reporting service request failed.';

  return new RpcException({
    statusCode,
    code: `REPORTING_${HttpStatus[statusCode] ?? 'ERROR'}`,
    message,
    retryable: statusCode >= 500,
  });
}

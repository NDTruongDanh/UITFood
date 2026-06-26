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
  promotionRpcErrorSchema,
  type PromotionRpcPattern,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';
import type { PromotionRpcGateway } from './promotion.interfaces';
import { PROMOTION_TCP_CLIENT } from './promotion.tokens';

@Injectable()
export class NestPromotionRpcClient
  implements PromotionRpcGateway, OnApplicationShutdown
{
  constructor(
    @Inject(PROMOTION_TCP_CLIENT) private readonly client: ClientProxy,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }

  async send<T = unknown>(
    pattern: PromotionRpcPattern,
    payload: unknown,
  ): Promise<T> {
    const timeoutMs = this.config.get('PROMOTION_RPC_TIMEOUT_MS', {
      infer: true,
    });
    try {
      return await firstValueFrom(
        this.client.send<T>(pattern, payload).pipe(timeout(timeoutMs)),
      );
    } catch (error) {
      const rpcError = promotionRpcErrorSchema.safeParse(error);
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
          'Promotion service request timed out.',
        );
      }
      throw new ServiceUnavailableException(
        'Promotion service is unavailable.',
        { cause: error },
      );
    }
  }
}

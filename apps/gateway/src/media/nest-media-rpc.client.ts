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
  MEDIA_RPC_PATTERNS,
  imageRecordSchema,
  listImagesResponseSchema,
  mediaRpcErrorSchema,
  uploadSignatureResponseSchema,
  type CreateImageRequest,
  type CreateUploadSignatureRequest,
  type ListImagesRequest,
} from '@uitfood/contracts';
import type { Env } from '@/config/env.schema';
import type { MediaRpcGateway } from './media.interfaces';
import { MEDIA_TCP_CLIENT } from './media.tokens';

@Injectable()
export class NestMediaRpcClient
  implements MediaRpcGateway, OnApplicationShutdown
{
  constructor(
    @Inject(MEDIA_TCP_CLIENT) private readonly client: ClientProxy,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }

  async listImages(input: ListImagesRequest) {
    const response = await this.send(MEDIA_RPC_PATTERNS.listImages, input);
    return listImagesResponseSchema.parse(response);
  }

  async createImage(input: CreateImageRequest) {
    const response = await this.send(MEDIA_RPC_PATTERNS.createImage, input);
    return imageRecordSchema.parse(response);
  }

  async createUploadSignature(input: CreateUploadSignatureRequest) {
    const response = await this.send(
      MEDIA_RPC_PATTERNS.createUploadSignature,
      input,
    );
    return uploadSignatureResponseSchema.parse(response);
  }

  private async send(pattern: string, payload: unknown): Promise<unknown> {
    const timeoutMs = this.config.get('MEDIA_RPC_TIMEOUT_MS', { infer: true });
    try {
      return await firstValueFrom(
        this.client.send(pattern, payload).pipe(timeout(timeoutMs)),
      );
    } catch (error) {
      const rpcError = mediaRpcErrorSchema.safeParse(error);
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
        throw new GatewayTimeoutException('Media service request timed out.');
      }
      throw new ServiceUnavailableException('Media service is unavailable.', {
        cause: error,
      });
    }
  }
}

import type { Request } from 'express';
import type {
  CreateImageRequest,
  CreateUploadSignatureRequest,
  ImageRecord,
  ListImagesRequest,
  ListImagesResponse,
  UploadSignatureResponse,
} from '@uitfood/contracts';

export interface MediaRpcGateway {
  listImages(input: ListImagesRequest): Promise<ListImagesResponse>;
  createImage(input: CreateImageRequest): Promise<ImageRecord>;
  createUploadSignature(
    input: CreateUploadSignatureRequest,
  ): Promise<UploadSignatureResponse>;
}

export interface SessionAuthenticator {
  isAuthenticated(request: Request): Promise<boolean>;
}

export interface MediaRouteOverrides {
  mediaClient?: MediaRpcGateway;
  sessionAuthenticator?: SessionAuthenticator;
}

import type {
  CreateImageRequest,
  CreateUploadSignatureRequest,
  ImageRecord,
  ListImagesRequest,
  ListImagesResponse,
  UploadSignatureResponse,
} from '@uitfood/contracts';
import type { SessionAuthenticator } from '@/identity/identity.interfaces';

export interface MediaRpcGateway {
  listImages(input: ListImagesRequest): Promise<ListImagesResponse>;
  createImage(input: CreateImageRequest): Promise<ImageRecord>;
  createUploadSignature(
    input: CreateUploadSignatureRequest,
  ): Promise<UploadSignatureResponse>;
}

export interface MediaRouteOverrides {
  mediaClient?: MediaRpcGateway;
  sessionAuthenticator?: SessionAuthenticator;
}

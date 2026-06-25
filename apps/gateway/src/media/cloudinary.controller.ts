import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { MediaRpcGateway } from './media.interfaces';
import { MEDIA_RPC_GATEWAY } from './media.tokens';
import { GatewaySessionGuard } from './gateway-session.guard';
import { InternalJwtService } from '@/identity/internal-jwt.service';
import type { GatewayRequestWithSession } from '@/identity/identity.interfaces';
import {
  CloudinarySignatureQueryDto,
  CloudinarySignatureResponseDto,
} from './dto/cloudinary.dto';

@ApiTags('Cloudinary')
@ApiBearerAuth()
@Controller('api/cloudinary')
export class CloudinaryController {
  constructor(
    @Inject(MEDIA_RPC_GATEWAY) private readonly media: MediaRpcGateway,
    private readonly internalJwt: InternalJwtService,
  ) {}

  @Get('signature')
  @UseGuards(GatewaySessionGuard)
  @ApiOperation({ summary: 'Get a signed upload signature' })
  @ApiOkResponse({ type: CloudinarySignatureResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session' })
  createSignature(
    @Req() request: GatewayRequestWithSession,
    @Query() query: CloudinarySignatureQueryDto,
  ) {
    return this.media.createUploadSignature({
      internalAuth: this.internalJwt.issueForRequest(request, 'media'),
      folder: query.folder,
    });
  }
}

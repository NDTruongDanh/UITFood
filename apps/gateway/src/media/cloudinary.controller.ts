import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
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
  ) {}

  @Get('signature')
  @UseGuards(GatewaySessionGuard)
  @ApiOperation({ summary: 'Get a signed upload signature' })
  @ApiOkResponse({ type: CloudinarySignatureResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session' })
  createSignature(@Query() query: CloudinarySignatureQueryDto) {
    return this.media.createUploadSignature({ folder: query.folder });
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { createHash } from 'node:crypto';
import type { MediaRpcGateway } from './media.interfaces';
import { MEDIA_RPC_GATEWAY } from './media.tokens';
import { GatewaySessionGuard } from './gateway-session.guard';
import {
  CreateImageDto,
  ImageListResponseDto,
  ImageResponseDto,
  PaginationQueryDto,
} from './dto/image.dto';

@ApiTags('Images')
@ApiBearerAuth()
@Controller('api/images')
export class MediaController {
  constructor(
    @Inject(MEDIA_RPC_GATEWAY) private readonly media: MediaRpcGateway,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List stored images' })
  @ApiOkResponse({ type: ImageListResponseDto })
  list(@Query() query: PaginationQueryDto) {
    return this.media.listImages({ offset: query.offset, limit: query.limit });
  }

  @Post()
  @UseGuards(GatewaySessionGuard)
  @ApiOperation({ summary: 'Store image metadata' })
  @ApiCreatedResponse({ type: ImageResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session' })
  create(
    @Body() dto: CreateImageDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    const key =
      idempotencyKey?.trim() ||
      `image:${createHash('sha256').update(dto.publicId).digest('hex')}`;
    if (key.length > 200) {
      throw new BadRequestException(
        'Idempotency-Key must not exceed 200 characters.',
      );
    }
    return this.media.createImage({ idempotencyKey: key, image: dto });
  }
}

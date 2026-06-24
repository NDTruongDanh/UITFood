import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

export class CreateImageDto {
  @ApiProperty({
    description: 'Cloudinary public ID',
    example: 'app-images/sample',
  })
  @IsString()
  publicId!: string;

  @ApiProperty({
    description: 'Secure Cloudinary delivery URL',
    example: 'https://res.cloudinary.com/demo/image/upload/v123/sample.jpg',
  })
  @IsUrl()
  secureUrl!: string;

  @ApiProperty({ description: 'Image width in pixels', example: 1200 })
  @IsInt()
  @Min(1)
  width!: number;

  @ApiProperty({ description: 'Image height in pixels', example: 800 })
  @IsInt()
  @Min(1)
  height!: number;
}

export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class ImageResponseDto extends CreateImageDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class ImageListResponseDto {
  @ApiProperty({ type: [ImageResponseDto] })
  data!: ImageResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;
}

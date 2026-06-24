import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CloudinarySignatureQueryDto {
  @ApiPropertyOptional({ example: 'app-images' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  folder?: string;
}

export class CloudinarySignatureResponseDto {
  @ApiProperty({ example: 'demo' })
  cloudName!: string;

  @ApiProperty({ example: '123456789012345' })
  apiKey!: string;

  @ApiProperty({ example: 1715279900 })
  timestamp!: number;

  @ApiProperty({ example: 'signed-value' })
  signature!: string;

  @ApiProperty({ example: 'app-images' })
  folder!: string;
}

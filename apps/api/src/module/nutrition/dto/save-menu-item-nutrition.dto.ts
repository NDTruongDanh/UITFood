import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaveNutritionValuesDto {
  @ApiProperty({ example: 660 })
  @IsNumber()
  calories!: number;

  @ApiProperty({ example: 55 })
  @IsNumber()
  protein!: number;

  @ApiProperty({ example: 45 })
  @IsNumber()
  carbs!: number;

  @ApiProperty({ example: 21 })
  @IsNumber()
  fat!: number;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber()
  fiber?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber()
  sugar?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber()
  sodium?: number | null;
}

export class SavedNutritionIngredientDto {
  @ApiProperty({ example: 'uc ga' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0)
  quantityGram!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  matchedFoodId?: string | null;
}

export class SaveMenuItemNutritionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  analysisSessionId!: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(1)
  servings!: number;

  @ApiProperty({ type: SaveNutritionValuesDto })
  @ValidateNested()
  @Type(() => SaveNutritionValuesDto)
  nutrition!: SaveNutritionValuesDto;

  @ApiProperty({ type: [SavedNutritionIngredientDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SavedNutritionIngredientDto)
  ingredients!: SavedNutritionIngredientDto[];

  @ApiProperty({ example: true })
  @IsBoolean()
  verifiedByRestaurant!: boolean;
}


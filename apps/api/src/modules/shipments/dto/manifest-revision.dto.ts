import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ManifestItemDto {
  @ApiPropertyOptional({ description: 'Optional linked ProductVariant ID for existing catalogue products' })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({ description: 'Item name on manifest', example: 'Whirlpool 24cu ft Refrigerator' })
  @IsNotEmpty()
  @IsString()
  productName!: string;

  @ApiPropertyOptional({ description: 'Product collection / category', example: 'Kitchen' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'Expected quantity', example: 4 })
  @IsInt()
  quantity!: number;

  @ApiProperty({ description: 'Unit cost in cents', example: 42000 })
  @IsInt()
  unitCostCents!: number;

  @ApiPropertyOptional({ description: 'Line notes', example: 'Stainless finish' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ManifestRevisionDto {
  @ApiProperty({ type: [ManifestItemDto], description: 'Manifest line items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManifestItemDto)
  items!: ManifestItemDto[];

  @ApiPropertyOptional({ description: 'Revision notes', example: 'Updated quantities after supplier invoice' })
  @IsOptional()
  @IsString()
  notes?: string;
}

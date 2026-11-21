import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateRequestDto {
  @ApiPropertyOptional({ description: 'Requested product name', example: 'Samsung 65-inch QLED TV' })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiPropertyOptional({ description: 'Product category', example: 'Electronics' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'Requested product description', example: 'Samsung 65-inch QLED 4K Smart TV' })
  @IsNotEmpty()
  @IsString()
  description!: string;

  @ApiPropertyOptional({ description: 'Requested quantity', example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Target budget in pesewas/cents', example: 1200000 })
  @IsOptional()
  @IsInt()
  budgetCents?: number;

  @ApiPropertyOptional({ description: 'Optional reference image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Optional marketplace reference URL' })
  @IsOptional()
  @IsString()
  referenceUrl?: string;

  @ApiPropertyOptional({ description: 'Additional sourcing notes', example: 'Prefer 2025/2026 model' })
  @IsOptional()
  @IsString()
  notes?: string;
}

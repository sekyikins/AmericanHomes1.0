import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ description: 'Product display name', example: 'Ashley Leather Recliner Sofa' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Product description', example: '3-seater dark espresso leather recliner.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Category slug or name', example: 'living-room' })
  @IsNotEmpty()
  @IsString()
  category!: string;

  @ApiPropertyOptional({ description: 'Brand name', example: 'Ashley Furniture' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ description: 'Model number/name', example: 'AH-REC-300' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ description: 'Technical specifications' })
  @IsOptional()
  @IsString()
  specifications?: string;

  @ApiPropertyOptional({ enum: ['NEW', 'GOOD', 'FAIR', 'POOR', 'DEFECTIVE'], default: 'GOOD' })
  @IsOptional()
  @IsIn(['NEW', 'GOOD', 'FAIR', 'POOR', 'DEFECTIVE'])
  condition?: string;

  @ApiPropertyOptional({ enum: ['NORMAL_SALE', 'DISCOUNTED_SALE', 'HELD_FOR_REVIEW', 'NOT_FOR_SALE'], default: 'NORMAL_SALE' })
  @IsOptional()
  @IsIn(['NORMAL_SALE', 'DISCOUNTED_SALE', 'HELD_FOR_REVIEW', 'NOT_FOR_SALE'])
  disposition?: string;

  @ApiPropertyOptional({ description: 'Disclosed defects shown to customers before purchase' })
  @IsOptional()
  @IsString()
  defectDisclosures?: string;

  @ApiPropertyOptional({ description: 'Originating shipment ID' })
  @IsOptional()
  @IsString()
  shipmentId?: string;

  @ApiPropertyOptional({ description: 'Initial received unit quantity entering preparation', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  initialQuantity?: number;

  @ApiPropertyOptional({ description: 'Optional initial variant display name', example: 'Small / Red' })
  @IsOptional()
  @IsString()
  initialVariantName?: string;

  @ApiPropertyOptional({
    description: 'Optional structured variant attributes (e.g. { Size: "Small", Color: "Red" })',
    example: { Size: 'Small', Color: 'Red' },
  })
  @IsOptional()
  @IsObject()
  initialAttributes?: Record<string, string>;
}

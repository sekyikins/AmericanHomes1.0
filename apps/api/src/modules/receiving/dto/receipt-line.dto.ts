import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RecordReceiptLineDto {
  @ApiPropertyOptional({ description: 'Manifest item ID if matched', example: 'mi-001' })
  @IsOptional()
  @IsString()
  manifestItemId?: string;

  @ApiPropertyOptional({ description: 'Product variant ID for stock admission', example: 'var-001' })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({ description: 'Quantity received', example: 2, minimum: 0 })
  @IsInt()
  @Min(0)
  receivedQty!: number;

  @ApiProperty({ enum: ['GOOD', 'DAMAGED', 'INCOMPLETE'], default: 'GOOD', example: 'GOOD' })
  @IsIn(['GOOD', 'DAMAGED', 'INCOMPLETE'])
  condition = 'GOOD';

  @ApiPropertyOptional({ description: 'Inspection notes', example: 'Outer carton intact' })
  @IsOptional()
  @IsString()
  notes?: string;
}

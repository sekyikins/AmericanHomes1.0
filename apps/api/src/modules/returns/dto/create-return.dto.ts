import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReturnLineItemDto {
  @ApiProperty({ description: 'Product variant ID to return' })
  @IsNotEmpty()
  @IsString()
  variantId!: string;

  @ApiProperty({ description: 'Quantity to return', minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateReturnDto {
  @ApiProperty({ description: 'Order ID for return request', example: 'ord-001' })
  @IsNotEmpty()
  @IsString()
  orderId!: string;

  @ApiProperty({ description: 'Return reason', example: 'Defective compressor on delivery' })
  @IsNotEmpty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional({ description: 'Additional details', example: 'Unit fails to power on' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Specific items and quantities to return (supports partial returns)',
    type: [ReturnLineItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnLineItemDto)
  lines?: ReturnLineItemDto[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class OrderLineDto {
  @ApiProperty({ description: 'Product variant ID', example: 'var-001' })
  @IsNotEmpty()
  @IsString()
  variantId!: string;

  @ApiProperty({ description: 'Quantity ordered', example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: 'Agreed unit price in pesewas/cents', example: 350000 })
  @IsInt()
  @Min(0)
  unitPriceCents!: number;
}

export class WalkInOrderDto {
  @ApiPropertyOptional({ description: 'Existing customer ID (optional for walk-in)', example: 'cust-001' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ type: [OrderLineDto], description: 'Order line items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines!: OrderLineDto[];

  @ApiPropertyOptional({ description: 'Optional order notes', example: 'Walk-in showroom sale' })
  @IsOptional()
  @IsString()
  notes?: string;
}

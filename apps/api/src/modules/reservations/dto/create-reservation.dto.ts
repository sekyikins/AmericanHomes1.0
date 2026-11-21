import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ description: 'Product variant ID to reserve', example: 'var-001' })
  @IsNotEmpty()
  @IsString()
  productVariantId!: string;

  @ApiProperty({ description: 'Quantity to reserve', example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Customer notes', example: 'Will pay within 48 hours' })
  @IsOptional()
  @IsString()
  notes?: string;
}

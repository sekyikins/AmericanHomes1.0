import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CommitStockDto {
  @ApiProperty({ description: 'Product variant ID', example: 'var-001' })
  @IsNotEmpty()
  @IsString()
  variantId!: string;

  @ApiProperty({ description: 'Quantity to hold/commit', example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: 'Reason for stock commitment', example: 'RESERVATION_HOLD' })
  @IsNotEmpty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional({ description: 'Reference entity type', example: 'Reservation' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ description: 'Reference entity ID', example: 'res-001' })
  @IsOptional()
  @IsString()
  referenceId?: string;
}

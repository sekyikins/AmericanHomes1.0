import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CancelOrderDto {
  @ApiPropertyOptional({ description: 'Reason for cancelling order', example: 'Customer requested cancellation' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ enum: ['ORIGINAL', 'STORE_CREDIT'], description: 'How to settle verified payments' })
  @IsOptional()
  @IsIn(['ORIGINAL', 'STORE_CREDIT'])
  refundMethod?: 'ORIGINAL' | 'STORE_CREDIT';

  @ApiPropertyOptional({ description: 'Optional restocking fee in basis points (e.g. 1000 = 10%)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  restockingFeeBps?: number;
}

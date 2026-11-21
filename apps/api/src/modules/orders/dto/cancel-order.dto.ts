import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelOrderDto {
  @ApiPropertyOptional({ description: 'Reason for cancelling order', example: 'Customer requested cancellation' })
  @IsOptional()
  @IsString()
  reason?: string;
}

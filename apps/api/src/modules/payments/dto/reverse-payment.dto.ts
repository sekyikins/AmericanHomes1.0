import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReversePaymentDto {
  @ApiPropertyOptional({ description: 'Reason for payment reversal', example: 'Duplicate manual entry' })
  @IsOptional()
  @IsString()
  reason?: string;
}

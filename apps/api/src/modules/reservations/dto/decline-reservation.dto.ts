import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DeclineReservationDto {
  @ApiPropertyOptional({ description: 'Reason for declining reservation', example: 'Item no longer available' })
  @IsOptional()
  @IsString()
  reason?: string;
}

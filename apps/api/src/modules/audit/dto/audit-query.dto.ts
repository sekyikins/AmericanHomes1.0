import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/utils/pagination';

export class AuditQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by actor user ID', example: 'user-123' })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({ description: 'Filter by audit action name', example: 'PAYMENT_APPROVED' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by entity type', example: 'Payment' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ description: 'Start ISO date-time', example: '2026-01-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End ISO date-time', example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

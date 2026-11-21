import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/utils/pagination';

export class CustomerQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by customer name, phone, or email', example: 'Ama' })
  @IsOptional()
  @IsString()
  search?: string;
}

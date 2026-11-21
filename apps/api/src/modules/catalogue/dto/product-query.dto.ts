import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/utils/pagination';

export class ProductQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by category slug', example: 'living-room' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Search keyword', example: 'recliner' })
  @IsOptional()
  @IsString()
  search?: string;
}

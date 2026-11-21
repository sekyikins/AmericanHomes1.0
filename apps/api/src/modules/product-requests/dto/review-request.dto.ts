import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReviewRequestDto {
  @ApiProperty({ enum: ['UNDER_REVIEW', 'SOURCING', 'DECLINED'], example: 'SOURCING' })
  @IsNotEmpty()
  @IsIn(['UNDER_REVIEW', 'SOURCING', 'DECLINED'])
  decision!: string;

  @ApiPropertyOptional({ description: 'Review notes', example: 'Added to next container sourcing list' })
  @IsOptional()
  @IsString()
  notes?: string;
}

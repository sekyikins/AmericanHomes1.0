import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class ReviewRequestDto {
  @ApiProperty({
    enum: ['UNDER_REVIEW', 'APPROVED_FOR_SOURCING', 'SOURCING', 'DECLINED'],
    example: 'APPROVED_FOR_SOURCING',
  })
  @IsNotEmpty()
  @IsIn(['UNDER_REVIEW', 'APPROVED_FOR_SOURCING', 'SOURCING', 'DECLINED'])
  decision!: string;

  @ApiPropertyOptional({ description: 'Estimated quoted landed price in pesewas (GHS cents)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  quotedPriceCents?: number;

  @ApiPropertyOptional({ description: 'Review notes', example: 'Added to next container sourcing list' })
  @IsOptional()
  @IsString()
  notes?: string;
}

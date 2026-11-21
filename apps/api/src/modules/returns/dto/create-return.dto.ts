import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateReturnDto {
  @ApiProperty({ description: 'Order ID for return request', example: 'ord-001' })
  @IsNotEmpty()
  @IsString()
  orderId!: string;

  @ApiProperty({ description: 'Return reason', example: 'Defective compressor on delivery' })
  @IsNotEmpty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional({ description: 'Additional details', example: 'Unit fails to power on' })
  @IsOptional()
  @IsString()
  notes?: string;
}

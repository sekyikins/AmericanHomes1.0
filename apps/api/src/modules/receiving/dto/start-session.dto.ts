import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class StartReceivingSessionDto {
  @ApiProperty({ description: 'Shipment ID being received', example: 'shp-001' })
  @IsNotEmpty()
  @IsString()
  shipmentId!: string;

  @ApiPropertyOptional({ description: 'Receiving session notes', example: 'Bay 2 unloading' })
  @IsOptional()
  @IsString()
  notes?: string;
}
